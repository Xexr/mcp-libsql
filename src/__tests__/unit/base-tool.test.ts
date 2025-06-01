import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  BaseTool,
  ToolRegistry,
  type ToolExecutionContext,
  type ToolExecutionResult
} from '../../lib/base-tool.js';
import type { DatabaseConnection } from '../../types/index.js';

// Mock the logger
vi.mock('../../lib/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

// Create a concrete test tool for testing BaseTool functionality
class TestTool extends BaseTool {
  readonly name = 'test-tool';
  readonly description = 'A test tool for unit testing';
  readonly inputSchema = z.object({
    query: z.string(),
    optional: z.string().optional(),
    withDefault: z.string().default('default-value'),
    numberField: z.number(),
    booleanField: z.boolean(),
    arrayField: z.array(z.string()).optional(),
    enumField: z.enum(['option1', 'option2']).optional(),
    unionField: z.union([z.string(), z.number()]).optional()
  });

  public shouldSucceed = true;
  public shouldThrow = false;
  public executionResult: ToolExecutionResult = {
    content: [{ type: 'text', text: 'Success' }]
  };

  protected async executeImpl(_context: ToolExecutionContext): Promise<ToolExecutionResult> {
    if (this.shouldThrow) {
      throw new Error('Test execution error');
    }

    if (!this.shouldSucceed) {
      return {
        content: [{ type: 'text', text: 'Tool failed' }],
        isError: true
      };
    }

    return this.executionResult;
  }
}

// Test tool with minimal schema
class MinimalTool extends BaseTool {
  readonly name = 'minimal-tool';
  readonly description = 'Minimal test tool';
  readonly inputSchema = z.object({
    required: z.string()
  });

  protected async executeImpl(_context: ToolExecutionContext): Promise<ToolExecutionResult> {
    return {
      content: [{ type: 'text', text: 'Minimal success' }]
    };
  }
}

// Test tool with complex schema types
class ComplexSchemaTool extends BaseTool {
  readonly name = 'complex-schema-tool';
  readonly description = 'Tool with complex schema types';
  readonly inputSchema = z.object({
    refined: z.string().refine(val => val.length > 0, 'Must not be empty'),
    nullable: z.string().nullable(),
    nullType: z.null(),
    nestedArray: z.array(z.object({ id: z.number() }))
  });

  protected async executeImpl(_context: ToolExecutionContext): Promise<ToolExecutionResult> {
    return {
      content: [{ type: 'text', text: 'Complex success' }]
    };
  }
}

describe('BaseTool', () => {
  let testTool: TestTool;
  let mockConnection: DatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    testTool = new TestTool();
    mockConnection = {} as DatabaseConnection;
  });

  describe('getToolDefinition', () => {
    it('should return correct tool definition', () => {
      const definition = testTool.getToolDefinition();

      expect(definition.name).toBe('test-tool');
      expect(definition.description).toBe('A test tool for unit testing');
      expect(definition.inputSchema).toEqual({
        type: 'object',
        properties: {
          query: { type: 'string' },
          optional: { type: 'string' },
          withDefault: { type: 'string' },
          numberField: { type: 'number' },
          booleanField: { type: 'boolean' },
          arrayField: { type: 'array', items: { type: 'string' } },
          enumField: { type: 'string', enum: ['option1', 'option2'] },
          unionField: { anyOf: [{ type: 'string' }, { type: 'number' }] }
        },
        required: ['query', 'numberField', 'booleanField']
      });
    });

    it('should handle minimal schema', () => {
      const minimalTool = new MinimalTool();
      const definition = minimalTool.getToolDefinition();

      expect(definition.inputSchema).toEqual({
        type: 'object',
        properties: {
          required: { type: 'string' }
        },
        required: ['required']
      });
    });

    it('should handle complex schema types', () => {
      const complexTool = new ComplexSchemaTool();
      const definition = complexTool.getToolDefinition();

      expect(definition.inputSchema.properties).toEqual({
        refined: { type: 'string' },
        nullable: { type: 'string' },
        nullType: { type: 'null' },
        nestedArray: {
          type: 'array',
          items: { type: 'string' } // The base implementation falls back to string for complex objects
        }
      });
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid arguments', async () => {
      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true
        }
      };

      const result = await testTool.execute(context);

      expect(result.content).toEqual([{ type: 'text', text: 'Success' }]);
      expect(result.isError).toBeUndefined();
    });

    it('should execute successfully with optional and default values', async () => {
      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true,
          optional: 'optional-value',
          arrayField: ['item1', 'item2'],
          enumField: 'option1',
          unionField: 'string-value'
        }
      };

      const result = await testTool.execute(context);

      expect(result.content).toEqual([{ type: 'text', text: 'Success' }]);
      expect(result.isError).toBeUndefined();
    });

    it('should handle validation errors', async () => {
      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 'not-a-number', // Invalid type
          booleanField: true
        }
      };

      const result = await testTool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Invalid arguments for tool test-tool')
      });
    });

    it('should handle missing required fields', async () => {
      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test'
          // Missing required numberField and booleanField
        }
      };

      const result = await testTool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Invalid arguments for tool test-tool')
      });
    });

    it('should handle tool execution failure', async () => {
      testTool.shouldSucceed = false;

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true
        }
      };

      const result = await testTool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: 'Tool failed' }]);
    });

    it('should handle exceptions thrown during execution', async () => {
      testTool.shouldThrow = true;

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true
        }
      };

      const result = await testTool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Error executing test-tool: Test execution error'
      });
    });

    it('should handle non-Error exceptions', async () => {
      // Mock executeImpl to throw a non-Error object
      vi.spyOn(testTool, 'executeImpl' as any).mockRejectedValue('String error');

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true
        }
      };

      const result = await testTool.execute(context);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Error executing test-tool: String error'
      });
    });

    it('should pass validated arguments to executeImpl', async () => {
      const executeSpy = vi.spyOn(testTool, 'executeImpl' as any);

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true,
          optional: 'test'
        }
      };

      await testTool.execute(context);

      expect(executeSpy).toHaveBeenCalledWith({
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true,
          optional: 'test',
          withDefault: 'default-value' // Zod adds default values
        }
      });
    });
  });

  describe('zodSchemaToJsonSchema conversion', () => {
    it('should handle non-object schemas', () => {
      class StringTool extends BaseTool {
        readonly name = 'string-tool';
        readonly description = 'String tool';
        readonly inputSchema = z.string();

        protected async executeImpl(): Promise<ToolExecutionResult> {
          return { content: [{ type: 'text', text: 'success' }] };
        }
      }

      const tool = new StringTool();
      const definition = tool.getToolDefinition();

      expect(definition.inputSchema).toEqual({
        type: 'string'
      });
    });
  });
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let testTool: TestTool;
  let minimalTool: MinimalTool;
  let mockConnection: DatabaseConnection;

  beforeEach(() => {
    registry = new ToolRegistry();
    testTool = new TestTool();
    minimalTool = new MinimalTool();
    mockConnection = {} as DatabaseConnection;
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      expect(() => registry.register(testTool)).not.toThrow();
      expect(registry.get('test-tool')).toBe(testTool);
    });

    it('should throw error when registering duplicate tool', () => {
      registry.register(testTool);

      expect(() => registry.register(testTool)).toThrow('Tool test-tool is already registered');
    });

    it('should register multiple different tools', () => {
      registry.register(testTool);
      registry.register(minimalTool);

      expect(registry.get('test-tool')).toBe(testTool);
      expect(registry.get('minimal-tool')).toBe(minimalTool);
    });
  });

  describe('get', () => {
    it('should return undefined for unregistered tool', () => {
      expect(registry.get('unknown-tool')).toBeUndefined();
    });

    it('should return registered tool', () => {
      registry.register(testTool);
      expect(registry.get('test-tool')).toBe(testTool);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no tools registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered tools', () => {
      registry.register(testTool);
      registry.register(minimalTool);

      const tools = registry.getAll();
      expect(tools).toHaveLength(2);
      expect(tools).toContain(testTool);
      expect(tools).toContain(minimalTool);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return empty array when no tools registered', () => {
      expect(registry.getToolDefinitions()).toEqual([]);
    });

    it('should return tool definitions for all registered tools', () => {
      registry.register(testTool);
      registry.register(minimalTool);

      const definitions = registry.getToolDefinitions();
      expect(definitions).toHaveLength(2);

      const testToolDef = definitions.find(def => def.name === 'test-tool');
      const minimalToolDef = definitions.find(def => def.name === 'minimal-tool');

      expect(testToolDef).toBeDefined();
      expect(testToolDef?.description).toBe('A test tool for unit testing');

      expect(minimalToolDef).toBeDefined();
      expect(minimalToolDef?.description).toBe('Minimal test tool');
    });
  });

  describe('execute', () => {
    it('should execute registered tool successfully', async () => {
      registry.register(testTool);

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true
        }
      };

      const result = await registry.execute('test-tool', context);

      expect(result.content).toEqual([{ type: 'text', text: 'Success' }]);
      expect(result.isError).toBeUndefined();
    });

    it('should return error for unregistered tool', async () => {
      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {}
      };

      const result = await registry.execute('unknown-tool', context);

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Error: Unknown tool: unknown-tool'
      });
    });

    it('should pass through tool execution errors', async () => {
      testTool.shouldSucceed = false;
      registry.register(testTool);

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 42,
          booleanField: true
        }
      };

      const result = await registry.execute('test-tool', context);

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: 'Tool failed' }]);
    });

    it('should pass through validation errors', async () => {
      registry.register(testTool);

      const context: ToolExecutionContext = {
        connection: mockConnection,
        arguments: {
          query: 'SELECT * FROM test',
          numberField: 'invalid', // Should be number
          booleanField: true
        }
      };

      const result = await registry.execute('test-tool', context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments for tool test-tool');
    });
  });
});
