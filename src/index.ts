import { sync as glob } from 'glob'
import { gen, Target, NamedValue } from 'typei18n'
import * as fs from 'fs'
import * as path from 'path'
import * as webpack from 'webpack'

declare module 'webpack' {
  namespace compilation {
    interface Compilation {
      createChildCompiler(name: string, options: webpack.Configuration['output']): any
    }
  }
}

interface Options {
  context: string
}

const DEFAULT_OPTIONS: Options = {
  context: './locales'
}

export default class I18nPlugin {
  private name: string = this.constructor.name
  context: Options['context']
  
  constructor(public options: Partial<Options> = {}) {
    const { context } = { ...DEFAULT_OPTIONS, ...options }
    this.context = context
  }

  public apply(compiler: webpack.Compiler) {
    const context = this.resolveContext(compiler)
    const filePath = this.resolveBundleFile(context)
    const locales = this.resolveLocaleFiles(context)

    const outputOptions = {
      filename: `[name].lang.json`
    }

    compiler.hooks.make.tapAsync(this.name, (compilation: webpack.compilation.Compilation, cb: (err: any) => void) => {
      const childCompiler = compilation.createChildCompiler(`typei18n-webpack-plugin`, outputOptions)
      childCompiler.context = compiler.context      
          
      locales.forEach(locale => {
        new webpack.SingleEntryPlugin(
          compiler.context, 
          `${locale}`, 
          path.basename(locale, path.extname(locale))
        ).apply(childCompiler)
      })

      /**@todo HMR */
      childCompiler.hooks.compilation.tap(this.name, (compilation: webpack.compilation.Compilation) => {
        if (compilation.cache) {
          if (!compilation.cache[name]) {
            compilation.cache[name] = {}
          }
          compilation.cache = compilation.cache[name]
        }
      })

      childCompiler.runAsChild(cb)
    })

    compiler.hooks.emit.tap(this.name, (compilation: webpack.compilation.Compilation) => {
      const acc: NamedValue<any>[] = []

      Object.keys(compilation.assets).forEach(assetName => {
        if(/\.lang\.json$/.test(assetName)) {
          const asset = compilation.assets[assetName]
          const name = path.basename(assetName, path.extname(assetName))
          const value = eval(asset.source())
          acc.push({ name, value })
          delete compilation.assets[assetName]
        }
      })

      try {
        const result = gen(acc, Target.provider)
        fs.writeFileSync(filePath, result, `utf-8`)
      } catch(e) {
        compilation.errors.push(e)
      }
    })
  }

  private resolveContext(compiler: webpack.Compiler): string {
    return path.isAbsolute(this.context) 
      ? this.context 
      : path.resolve((compiler as any).context, this.context)
  }

  private resolveLocaleFiles(context: string): any[] {
    return glob(path.resolve(context, '**/*.yaml')).map(f => path.resolve(f))
  }

  private resolveBundleFile(context: string): string {
    return path.resolve(context, `index.ts`)
  }
}
