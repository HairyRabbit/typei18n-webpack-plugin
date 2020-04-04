import { sync as glob } from 'glob'
import { gen, Target, NamedValue } from 'typei18n'
import * as fs from 'fs'
import * as path from 'path'
import * as webpack from 'webpack'
import * as yaml from 'js-yaml'

interface Options {
  context: string,
  filename: string,
  exclude: RegExp[],
  logger: typeof console.log,
  verbose: boolean,
}

const DEFAULT_OPTIONS: Options = {
  context: './locales',
  filename: './index.ts',
  exclude: [],
  logger: console.log.bind(console),
  verbose: true,
}

export default class TypeI18nPlugin {
  private name: string = this.constructor.name
  private cache: Map<string, Date> = new Map
  private error: Error | null = null
  context: Options['context']
  filename: Options['filename']
  exclude: Options['exclude']
  logger: Options['logger']
  verbose: Options['verbose']
  
  constructor(public options: Readonly<Partial<Options>> = {}) {
    const { 
      context,
      filename,
      exclude,
      logger,
      verbose,
    } = {...DEFAULT_OPTIONS,  ...options, }
    // if(!context || !path.isAbsolute(context)) throw new Error(`[${this.name}] options.context should be a absoulte path`)
    this.context = context
    this.filename = filename
    this.exclude = exclude
    this.logger = logger
    this.verbose = verbose
  }

  private check(locales: { file: string, mtime: Date }[]): boolean {
    const cache = this.cache
    if(cache.size !== locales.length) return false
    for(let i = 0; i < locales.length; i++) {
      const { file, mtime } = locales[i]
      const cached_mtime = cache.get(file)
      if(!cached_mtime || cached_mtime.getTime() !== mtime.getTime()) return false
    }

    return true
  }

  private exec() {
    this.error = null
    const locales = this.resolveLocales()
    if(locales.length === 0 || this.check(locales)) return
    const files: NamedValue[] = []
    
    locales.map(({ file: locale, mtime }) => {
      files.push({
        name: path.basename(locale, '.yaml'),
        value: yaml.safeLoad(fs.readFileSync(locale, 'utf-8'))
      })

      this.cache.set(locale, mtime)
    })

    try {
      this.verbose && this.logger(`[${this.name}] Generating from ${files.map(f => f.name).join(', ')}`)
      const result = gen(files, Target.provider)
      fs.writeFileSync(this.filename, result, 'utf-8')
      this.verbose && this.logger(`[${this.name}] Successful`)
    } catch(e) {
      this.verbose && this.logger(`[${this.name}] Failure`)
      fs.existsSync(this.filename) && fs.unlinkSync(this.filename)
      this.error = e
    }
  }

  public apply(compiler: webpack.Compiler) {
    const context = compiler.context
    if(!path.isAbsolute(this.context)) this.context = path.resolve(context, this.context)
    if(!path.isAbsolute(this.filename)) this.filename = path.resolve(this.context, this.filename)

    compiler.hooks.run.tap(this.name, this.exec.bind(this))
    compiler.hooks.watchRun.tap(this.name, this.exec.bind(this))
    compiler.hooks.afterCompile.tap(this.name, (compilation: webpack.compilation.Compilation) => {
      if(this.error) compilation.errors.push(this.error)
      compilation.fileDependencies.delete(this.filename)
      this.cache.forEach((_mtime, locale) => compilation.fileDependencies.add(locale))
      compilation.contextDependencies.add(this.context)
    })
  }

  private resolveLocales() {
    return glob(path.resolve(this.context, '**/*.yaml'))
      .filter(filepath => !this.exclude.some(regexp => regexp.test(filepath)))
      .map(locale => ({
        file: locale,
        mtime: fs.statSync(locale).mtime
      }))
  }
}
