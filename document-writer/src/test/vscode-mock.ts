/**
 * Mock for the VS Code API to be used in tests
 */

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
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
            postMessage: jest.fn(),
        },
        onDidDispose: jest.fn(),
        onDidChangeViewState: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
    }),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
};

export const workspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn(),
        update: jest.fn(),
        has: jest.fn()
    }),
    openTextDocument: jest.fn(),
    findFiles: jest.fn().mockResolvedValue([]),
    asRelativePath: jest.fn().mockImplementation(path => path),
    fs: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        createDirectory: jest.fn(),
        stat: jest.fn(),
        readDirectory: jest.fn()
    },
    workspaceFolders: []
};

export const commands = {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
};

export const ExtensionContext = {
    subscriptions: [],
    extensionPath: '/mock/extension/path',
    globalState: {
        get: jest.fn(),
        update: jest.fn()
    },
    workspaceState: {
        get: jest.fn(),
        update: jest.fn()
    },
    storageUri: { fsPath: '/mock/storage/path' },
    globalStorageUri: { fsPath: '/mock/global/storage/path' },
    logUri: { fsPath: '/mock/log/path' },
    extensionUri: { fsPath: '/mock/extension/uri' },
    asAbsolutePath: jest.fn().mockImplementation(path => `/mock/extension/path/${path}`)
};

export const Uri = {
    file: jest.fn().mockImplementation(path => ({ fsPath: path })),
    parse: jest.fn().mockImplementation(path => ({ fsPath: path }))
};

export const env = {
    clipboard: {
        writeText: jest.fn()
    },
    openExternal: jest.fn()
};

export const ThemeColor = jest.fn();
export const TreeItem = jest.fn().mockImplementation(() => ({
    command: null,
    contextValue: '',
    iconPath: undefined,
    id: '',
    label: '',
    tooltip: ''
}));
export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};
export const EventEmitter = jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn()
}));
export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
};
export const ViewColumn = {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3
};

// Mock for Disposable
export const Disposable = {
    from: jest.fn().mockImplementation((..._disposables) => ({
        dispose: jest.fn()
    }))
};

// Mock for the Position class
export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
}

// Mock for the Range class
export class Range {
    constructor(
        public readonly start: Position,
        public readonly end: Position
    ) {}
}

// Mock for the Selection class
export class Selection extends Range {
    constructor(
        public readonly anchor: Position,
        public readonly active: Position
    ) {
        super(anchor, active);
    }
}

// Mock for the StatusBarItem
export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const ProgressLocation = {
    Notification: 15,
    Window: 10
};

export const extensions = {
    getExtension: jest.fn()
};

export const ExtensionMode = {
    Production: 1,
    Development: 2,
    Test: 3
};
