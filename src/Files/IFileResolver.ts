export interface IFileResolver {
    FileUri: string;
    Exception: NodeJS.ErrnoException | null;
}
