/**
 * A mock implementation of the VS Code API for use in tests
 */
module.exports = {
  // Mock of the VS Code workspace API
  workspace: {
    getConfiguration: jest.fn().mockImplementation((section) => ({
      get: jest.fn().mockImplementation((key, defaultValue) => {
        // Default mock values for configuration
        const mockConfig = {
          'documentWriter.defaultAuthor': 'Test Author',
          'documentWriter.outputPath': './generated-documents'
        };
        
        const fullKey = section ? `${section}.${key}` : key;
        return mockConfig[fullKey] !== undefined ? mockConfig[fullKey] : defaultValue;
      }),
      update: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockReturnValue(true)
    })),
    onDidChangeConfiguration: jest.fn().mockImplementation(callback => {
      return { dispose: jest.fn() };
    }),
    workspaceFolders: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
    fs: {
      readFile: jest.fn().mockImplementation(async (uri) => {
        return Buffer.from('mock file content');
      }),
      writeFile: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ type: 1, size: 100 }),
      createDirectory: jest.fn().mockResolvedValue(undefined)
    }
  },
  
  // Mock of the VS Code window API
  window: {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue('test input'),
    showQuickPick: jest.fn().mockImplementation(items => Promise.resolve(items[0])),
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }),
    createWebviewPanel: jest.fn().mockReturnValue({
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn().mockResolvedValue(true),
        options: {},
        dispose: jest.fn()
      },
      onDidDispose: jest.fn().mockImplementation(callback => {
        return { dispose: jest.fn() };
      }),
      reveal: jest.fn(),
      dispose: jest.fn()
    })
  },
  
  // Mock of the VS Code commands API
  commands: {
    registerCommand: jest.fn().mockImplementation((command, callback) => {
      return { dispose: jest.fn() };
    }),
    executeCommand: jest.fn().mockResolvedValue(undefined)
  },
  
  // Mock of the VS Code extensions API
  extensions: {
    getExtension: jest.fn().mockReturnValue({
      packageJSON: { version: '1.0.0' },
      extensionPath: '/test-extension-path',
      activate: jest.fn().mockResolvedValue(null)
    })
  },
  
  // Mock of the VS Code Uri API
  Uri: {
    file: jest.fn().mockImplementation(path => ({ fsPath: path })),
    parse: jest.fn().mockImplementation(uri => ({ fsPath: uri.replace('file://', '') }))
  },
  
  // Mock of the VS Code Disposable
  Disposable: {
    from: jest.fn().mockImplementation((...disposables) => ({
      dispose: jest.fn()
    }))
  },
  
  // Mock event emitter factory
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn().mockImplementation(listener => ({
      dispose: jest.fn()
    })),
    fire: jest.fn()
  })),
  
  // Mock of the VS Code StatusBarItem
  StatusBarAlignment: {
    Left: 'left',
    Right: 'right'
  },
  
  // Mock of the VS Code TreeItem
  TreeItem: jest.fn().mockImplementation((label, collapsibleState) => ({
    label,
    collapsibleState,
    iconPath: undefined,
    contextValue: undefined,
    command: undefined
  })),
  
  // Mock of the VS Code TreeItemCollapsibleState
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  
  // Mock of the VS Code ThemeIcon
  ThemeIcon: {
    File: 'file',
    Folder: 'folder'
  },
  
  // Mock of VS Code Disposable
  Disposable: function(func) {
    return { dispose: func || jest.fn() };
  },
  
  // Mock of the VS Code ExtensionMode
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3
  }
};
