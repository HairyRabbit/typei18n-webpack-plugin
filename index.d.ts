import * as webpack from 'webpack';
interface Options {
    context: string;
    filename: string;
    exclude: RegExp[];
    logger: typeof console.log;
    verbose: boolean;
}
export default class TypeI18nPlugin {
    options: Readonly<Partial<Options>>;
    private name;
    private cache;
    private error;
    context: Options['context'];
    filename: Options['filename'];
    exclude: Options['exclude'];
    logger: Options['logger'];
    verbose: Options['verbose'];
    constructor(options?: Readonly<Partial<Options>>);
    private check;
    private exec;
    apply(compiler: webpack.Compiler): void;
    private resolveLocales;
}
export {};
