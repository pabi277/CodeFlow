import type { CompletionEntry } from './keywords'

function entries(values: string, type: CompletionEntry['type'] = 'keyword', detail?: string): CompletionEntry[] {
  return values.split(/\s+/).filter(Boolean).map((label) => ({ label, type, detail, origin: 'language' }))
}

/** Baseline IntelliSense catalogs for languages without a browser LSP. */
export const EXTRA_LANGUAGE_ENTRIES: Record<string, CompletionEntry[]> = {
  kotlin: [
    ...entries('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while by catch constructor delegate dynamic field file finally get import init param property receiver set setparam where actual abstract annotation companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg'),
    ...entries('Any Boolean Byte Char Double Float Int Long Nothing Short String Unit Array List MutableList Map MutableMap Set MutableSet', 'type'),
    ...entries('let run with apply also takeIf takeUnless lazy require check println readLine', 'function', 'Kotlin standard library'),
  ],
  swift: [
    ...entries('associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil super self Self throw throws true try async await actor some any'),
    ...entries('Any Bool Character Double Float Int String UInt Array Dictionary Optional Result Set', 'type'),
    ...entries('print debugPrint dump fatalError assertionFailure min max zip stride', 'function', 'Swift standard library'),
  ],
  ruby: [
    ...entries('BEGIN END alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield'),
    ...entries('Array Class Dir Exception File Hash Integer IO Module Object Range Regexp String Symbol Time', 'type'),
    ...entries('puts print p gets require attr_reader attr_writer attr_accessor lambda loop raise fail', 'function', 'Ruby core'),
  ],
  lua: [
    ...entries('and break do else elseif end false for function goto if in local nil not or repeat return then true until while'),
    ...entries('assert collectgarbage dofile error getmetatable ipairs load next pairs pcall print rawequal rawget rawlen rawset require select setmetatable tonumber tostring type warn xpcall', 'function', 'Lua global'),
    ...entries('math string table io os coroutine package utf8', 'variable', 'standard library'),
  ],
  csharp: [
    ...entries('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while async await get set init required file global'),
    ...entries('Console String Math DateTime List Dictionary HashSet Task IEnumerable', 'type'),
    ...entries('WriteLine Write ReadLine Parse TryParse', 'function', '.NET'),
  ],
  dart: [
    ...entries('abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for function get hide if implements import in interface is late library mixin new null on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield sealed base interface final'),
    ...entries('bool double int num String List Map Set Future Stream Object Duration DateTime', 'type'),
    ...entries('print identical', 'function', 'Dart core'),
  ],
  scala: [
    ...entries('abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait try true type val var while with yield given using enum export extension then end'),
    ...entries('Any AnyRef Boolean Byte Char Double Float Int Long Nothing Option String Unit List Map Set Seq Future', 'type'),
  ],
  perl: [
    ...entries('continue do else elsif eval for foreach given goto if last local my next no package redo require return state sub unless until use when while our'),
    ...entries('print say chomp chop defined delete exists grep join keys map open push pop shift sort split sprintf substr values warn', 'function', 'Perl builtin'),
  ],
  r: [
    ...entries('if else repeat while function for in next break TRUE FALSE NULL Inf NaN NA'),
    ...entries('c list data.frame matrix array factor length nrow ncol names class typeof print cat paste sprintf seq rep sort order apply lapply sapply tapply library require source read.csv write.csv', 'function', 'R base'),
  ],
  pascal: [
    ...entries('and array begin case const div do downto else end file for function goto if in label mod nil not of or packed procedure program record repeat set then to type until var while with unit interface implementation uses'),
    ...entries('Boolean Byte Char Integer LongInt Real String Word', 'type'),
    ...entries('Write WriteLn Read ReadLn Length SetLength Inc Dec', 'function', 'Pascal runtime'),
  ],
  groovy: [
    ...entries('as assert break case catch class const continue def default do else enum extends false finally for goto if implements import in instanceof interface new null package return super switch this throw throws trait true try while public protected private static final'),
    ...entries('String List Map Set BigDecimal Closure Object', 'type'),
    ...entries('println print each collect find findAll inject', 'function', 'Groovy runtime'),
  ],
  fsharp: [
    ...entries('abstract and as assert base begin class default delegate do done downcast downto elif else end exception extern false finally fixed for fun function global if in inherit inline interface internal lazy let match member module mutable namespace new null of open or override private public rec return static struct then to true try type upcast use val void when while with yield async'),
    ...entries('bool byte char decimal double float int int64 list map option result seq string unit', 'type'),
  ],
  ocaml: [
    ...entries('and as assert begin class constraint do done downto else end exception external false for fun function functor if in include inherit initializer lazy let match method module mutable new object of open or private rec sig struct then to true try type val virtual when while with'),
    ...entries('bool bytes char float int list option result string unit', 'type'),
  ],
  clojure: [
    ...entries('def defn defmacro fn if if-not when when-not cond case let letfn loop recur do quote var throw try catch finally new set! ns in-ns require use import refer'),
    ...entries('map reduce filter remove keep apply comp partial juxt assoc dissoc get update conj disj into merge select-keys keys vals first rest next count empty? seq println prn str keyword symbol vector hash-map hash-set', 'function', 'Clojure core'),
  ],
  vbnet: [
    ...entries('AddHandler AddressOf Alias And AndAlso As Boolean ByRef Byte ByVal Call Case Catch Class Const Continue Date Decimal Declare Default Delegate Dim DirectCast Do Double Each Else ElseIf End Enum Erase Error Event Exit False Finally For Friend Function Get GetType Global GoSub GoTo Handles If Implements Imports In Inherits Integer Interface Is Let Lib Like Long Loop Me Mod Module MustInherit MustOverride MyBase MyClass Namespace Narrowing New Next Not Nothing Object Of On Operator Option Optional Or OrElse Overloads Overridable Overrides ParamArray Partial Private Property Protected Public RaiseEvent ReadOnly ReDim REM RemoveHandler Resume Return SByte Select Set Shadows Shared Short Single Static Step Stop String Structure Sub SyncLock Then Throw To True Try TypeOf UInteger ULong UShort Using Variant Wend When While Widening With WithEvents WriteOnly Xor'),
  ],
  cobol: [
    ...entries('ACCEPT ADD CALL CANCEL CLOSE COMPUTE CONTINUE DELETE DISPLAY DIVIDE ELSE END-IF EVALUATE EXIT GOBACK GO IF INITIALIZE INSPECT MOVE MULTIPLY OPEN PERFORM READ REWRITE SEARCH SET SORT START STOP STRING SUBTRACT UNSTRING WHEN WRITE WORKING-STORAGE PROCEDURE DIVISION SECTION'),
  ],
}
