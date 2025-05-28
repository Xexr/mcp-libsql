import { z } from 'zod';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { DatabaseConnection } from '../types/index.js';
import { Logger } from './logger.js';

const logger = new Logger();

export interface ToolExecutionContext {
  connection: DatabaseConnection;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult extends CallToolResult {
  isError?: boolean;
}

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodSchema;

  protected abstract executeImpl(context: ToolExecutionContext): Promise<ToolExecutionResult>;

  getToolDefinition(): Tool {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        ...this.zodSchemaToJsonSchema(this.inputSchema)
      }
    };
  }

  async execute(context: ToolExecutionContext): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      // Validate input arguments
      const validationResult = this.inputSchema.safeParse(context.arguments);
      if (!validationResult.success) {
        const errorMessage = `Invalid arguments for tool ${this.name}: ${validationResult.error.message}`;
        logger.error('Tool validation failed', {
          tool: this.name,
          error: errorMessage,
          arguments: context.arguments
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`
            }
          ],
          isError: true
        };
      }

      // Update context with validated arguments
      const validatedContext: ToolExecutionContext = {
        ...context,
        arguments: validationResult.data
      };

      logger.info(`Executing tool: ${this.name}`, { arguments: validatedContext.arguments });

      // Execute the tool
      const result = await this.executeImpl(validatedContext);

      const executionTime = Date.now() - startTime;
      logger.info(`Tool executed successfully: ${this.name}`, {
        executionTime,
        hasError: result.isError || false
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Tool execution failed: ${this.name}`, {
        error: errorMessage,
        executionTime
      });

      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${this.name}: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  private zodSchemaToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
    // Basic conversion from Zod to JSON Schema
    // This is a simplified implementation - in production you might want to use zod-to-json-schema

    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJsonSchema(value as z.ZodTypeAny);

        // Check if field is required (not optional and not default)
        const zodField = value as z.ZodTypeAny;
        if (!zodField.isOptional() && !(zodField instanceof z.ZodDefault)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : []
      };
    }

    return this.zodTypeToJsonSchema(schema);
  }

  private zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
    if (zodType instanceof z.ZodString) {
      return { type: 'string' };
    }

    if (zodType instanceof z.ZodNumber) {
      return { type: 'number' };
    }

    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(zodType.element)
      };
    }

    if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    }

    if (zodType instanceof z.ZodDefault) {
      return this.zodTypeToJsonSchema(zodType._def.innerType);
    }

    if (zodType instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: zodType.options
      };
    }

    // Handle ZodUnion - convert to anyOf
    if (zodType instanceof z.ZodUnion) {
      return {
        anyOf: zodType.options.map((option: z.ZodTypeAny) => this.zodTypeToJsonSchema(option))
      };
    }

    // Handle ZodEffects (refined schemas) - use inner type
    if (zodType instanceof z.ZodEffects) {
      return this.zodTypeToJsonSchema(zodType._def.schema);
    }

    // Handle ZodNull
    if (zodType instanceof z.ZodNull) {
      return { type: 'null' };
    }

    // Default fallback
    return { type: 'string' };
  }
}

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name}`);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): Tool[] {
    return this.getAll().map(tool => tool.getToolDefinition());
  }

  async execute(name: string, context: ToolExecutionContext): Promise<CallToolResult> {
    const tool = this.get(name);
    if (!tool) {
      const errorMessage = `Unknown tool: ${name}`;
      logger.error('Tool not found', { tool: name });

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`
          }
        ],
        isError: true
      };
    }

    return tool.execute(context);
  }
}
