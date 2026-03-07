export interface IFormat {
    format: "compressed" | "expanded";
    extensionName: string;
    savePath?: string;
    savePathReplacementPairs?: Record<string, unknown>;
    generateMap?: boolean;
    generateMapIncludeSources?: boolean;
}
