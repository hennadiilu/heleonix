// perf/harness.ts
import { performance } from "node:perf_hooks";

// ../../runtime/hx-core/src/errors/HeleonixError.ts
var HeleonixError = class _HeleonixError extends Error {
  constructor(error, ...args) {
    const formattedMsg = _HeleonixError.formatMessage(error.message, ...args);
    super(formattedMsg);
    Object.setPrototypeOf(this, _HeleonixError.prototype);
    this.name = this.constructor.name;
    this.code = error.code;
  }
  static formatMessage(formatString, ...args) {
    let result = formatString;
    function replaceArg(value, index) {
      result = result?.replaceAll(`{${index}}`, value);
    }
    args.forEach(replaceArg);
    return result;
  }
};

// ../../runtime/hx-core/src/errors/Errors.ts
var Errors = {
  // Common errors 0001-0099
  unknownComponent: {
    code: "HX_CORE_0001",
    ...false
  },
  // Application errors 0100-0199
  applicationLifecycle: {
    code: "HX_CORE_0100",
    ...false
  },
  noRootElement: {
    code: "HX_CORE_0101",
    ...false
  },
  // Component errors 0200-0299
  componentCreation: {
    code: "HX_CORE_0200",
    ...false
  },
  componentBuild: {
    code: "HX_CORE_0201",
    ...false
  },
  componentUpdate: {
    code: "HX_CORE_0202",
    ...false
  },
  definitionRetrieval: {
    code: "HX_CORE_0203",
    ...false
  },
  invalidOverrideComponent: {
    code: "HX_CORE_0204",
    ...false
  },
  // Dictionary errors 0300-0399
  dictionaryDefinitionProviding: {
    code: "HX_CORE_0300",
    ...false
  },
  dictionaryEntryRetrieval: {
    code: "HX_CORE_0301",
    ...false
  },
  // Config errors 0400-0499
  configDefinitionProviding: {
    code: "HX_CORE_0400",
    ...false
  },
  configEntryRetrieval: {
    code: "HX_CORE_0401",
    ...false
  },
  // Binding errors 0500-0599
  unknownConverter: {
    code: "HX_CORE_0500",
    ...false
  },
  // Scheduler errors 0600-0699
  schedulerJob: {
    code: "HX_CORE_0600",
    ...false
  }
};

// ../../common/hx-language/src/names/COMPONENT_NAME_SEGMENT_SEPARATOR.ts
var COMPONENT_NAME_SEGMENT_SEPARATOR = ".";

// ../../common/hx-language/src/names/COMPONENT_PROPERTY_SEPARATOR.ts
var COMPONENT_PROPERTY_SEPARATOR = ":";

// ../../common/hx-language/src/names/PROPERTY_NAME_SEGMENT_SEPARATOR.ts
var PROPERTY_NAME_SEGMENT_SEPARATOR = ".";

// ../../common/hx-language/src/names/DICTIONARY_ENTRY_SEPARATOR.ts
var DICTIONARY_ENTRY_SEPARATOR = ".";

// ../../common/hx-language/src/names/CONFIG_ENTRY_SEPARATOR.ts
var CONFIG_ENTRY_SEPARATOR = ".";

// ../../common/hx-language/src/names/getPropertySegments.ts
function getPropertySegments(path) {
  return path ? path.split(PROPERTY_NAME_SEGMENT_SEPARATOR).filter(Boolean) : [];
}

// ../../common/hx-language/src/names/getComponentName.ts
function getComponentName(fqName) {
  return fqName ? fqName.slice(0, fqName.indexOf(COMPONENT_PROPERTY_SEPARATOR)) : "";
}

// ../../common/hx-language/src/names/getPropertyName.ts
function getPropertyName(fqName) {
  return fqName ? fqName.slice(fqName.indexOf(COMPONENT_PROPERTY_SEPARATOR) + 1) : "";
}

// ../../common/hx-language/src/names/joinFQPropertyName.ts
function joinFQPropertyName(component, property) {
  if (property.indexOf(COMPONENT_PROPERTY_SEPARATOR) >= 0) {
    return component + COMPONENT_NAME_SEGMENT_SEPARATOR + property;
  }
  return component + COMPONENT_PROPERTY_SEPARATOR + property;
}

// ../../common/hx-language/src/bindings/DICTIONARY_REF_PREFIX.ts
var DICTIONARY_REF_PREFIX = "@";

// ../../common/hx-language/src/bindings/CONFIG_REF_PREFIX.ts
var CONFIG_REF_PREFIX = "#";

// ../../common/hx-language/src/bindings/THEME_REF_PREFIX.ts
var THEME_REF_PREFIX = "$";

// ../../common/hx-language/src/bindings/CONVERTER_PIPE.ts
var CONVERTER_PIPE = "|";

// ../../common/hx-language/src/interpolation/CLOSE.ts
var CLOSE = "}";

// ../../common/hx-language/src/interpolation/OPEN.ts
var OPEN = "{";

// ../../common/hx-language/src/interpolation/splitOnTopLevel.ts
function splitOnTopLevel(input, separator) {
  const result = [];
  const len = input.length;
  let depth = 0;
  let start = 0;
  for (let i = 0; i < len; i++) {
    const ch = input.charAt(i);
    if (ch === OPEN) {
      depth++;
    } else if (ch === CLOSE) {
      if (depth > 0) {
        depth--;
      }
    } else if (ch === separator && depth === 0) {
      result.push(input.slice(start, i));
      start = i + 1;
    }
  }
  result.push(input.slice(start));
  return result;
}

// ../../common/hx-language/src/bindings/isLiteralSource.ts
var NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
function isLiteralSource(source) {
  return source === "true" || source === "false" || NUMBER.test(source);
}

// ../../common/hx-language/src/bindings/isStringLiteralSource.ts
function isStringLiteralSource(source) {
  return source.length >= 2 && source.charAt(0) === "'" && source.charAt(source.length - 1) === "'" && source.indexOf("'", 1) === source.length - 1;
}

// ../../common/hx-language/src/bindings/parseBindingExpression.ts
var cache = /* @__PURE__ */ new Map();
function parseBindingExpression(raw) {
  const cached = cache.get(raw);
  if (cached !== void 0) {
    return cached;
  }
  const expression = parseSource(raw);
  cache.set(raw, expression);
  return expression;
}
function parseSource(raw) {
  const segments = splitOnTopLevel(raw, CONVERTER_PIPE);
  const source = segments[0].trim();
  const converters = segments.slice(1).map((s) => s.trim()).filter(Boolean);
  let type;
  let value;
  if (source.charAt(0) === DICTIONARY_REF_PREFIX) {
    type = "dictionary";
    value = source.slice(1).trim();
  } else if (source.charAt(0) === CONFIG_REF_PREFIX) {
    type = "config";
    value = source.slice(1).trim();
  } else if (source.charAt(0) === THEME_REF_PREFIX) {
    type = "theme";
    value = source.slice(1).trim();
  } else if (isStringLiteralSource(source)) {
    type = "literal";
    value = JSON.stringify(source.slice(1, -1));
  } else if (isLiteralSource(source)) {
    type = "literal";
    value = source;
  } else {
    type = "state";
    value = source;
  }
  return converters.length > 0 ? { type, value, converters } : { type, value };
}

// ../../common/hx-language/src/bindings/parseConverterCall.ts
var ARGUMENT_SEPARATOR = ",";
var NAME_VALUE_SEPARATOR = ":";
var cache2 = /* @__PURE__ */ new Map();
function parseConverterCall(segment) {
  const cached = cache2.get(segment);
  if (cached !== void 0) {
    return cached;
  }
  const call = parseSegment(segment);
  cache2.set(segment, call);
  return call;
}
function parseSegment(segment) {
  const trimmed = segment.trim();
  const parenAt = trimmed.indexOf("(");
  if (parenAt < 0) {
    return { name: trimmed, args: {} };
  }
  const name = trimmed.slice(0, parenAt).trim();
  const inside = trimmed.slice(parenAt + 1, trimmed.lastIndexOf(")")).trim();
  if (inside === "") {
    throw new Error(`Converter '${name}' has empty parentheses - write it bare as '${name}'.`);
  }
  const args = {};
  for (const part of splitOnTopLevel(inside, ARGUMENT_SEPARATOR)) {
    const colonAt = part.indexOf(NAME_VALUE_SEPARATOR);
    if (colonAt < 0) {
      throw new Error(`Converter '${name}' argument '${part.trim()}' must be named as 'name: value'.`);
    }
    const argName = part.slice(0, colonAt).trim();
    const expression = parseBindingExpression(part.slice(colonAt + 1).trim());
    if (expression.converters) {
      throw new Error(
        `Converter '${name}' argument '${argName}' must be a plain source, not a '${CONVERTER_PIPE}' chain.`
      );
    }
    args[argName] = expression;
  }
  return { name, args };
}

// ../../common/hx-language/src/interpolation/EXPRESSION_PATTERN.ts
var EXPRESSION_PATTERN = `\\${OPEN}([^${CLOSE}]+)\\${CLOSE}`;

// ../../runtime/hx-core/src/common/isThenable.ts
function isThenable(value) {
  return value !== null && typeof value === "object" && typeof value.then === "function";
}

// ../../runtime/hx-core/src/common/thenMaybe.ts
function thenMaybe(value, fn) {
  return isThenable(value) ? value.then(fn) : fn(value);
}

// ../../runtime/hx-core/src/common/KeyedEventEmitter.ts
var KeyedEventEmitter = class {
  constructor(onInterceptor, offInterceptor) {
    this.onInterceptor = onInterceptor;
    this.offInterceptor = offInterceptor;
    this.handlers = /* @__PURE__ */ new Map();
  }
  emit(...args) {
    const handlers = this.handlers.get(args[0]);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      ;
      handler(...args);
    }
  }
  on(key, handler) {
    this.onInterceptor?.(key, handler);
    let handlers = this.handlers.get(key);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this.handlers.set(key, handlers);
    }
    handlers.add(handler);
  }
  off(key, handler) {
    this.offInterceptor?.(key, handler);
    const handlers = this.handlers.get(key);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlers.delete(key);
    }
  }
};

// ../../runtime/hx-core/src/state/StateManager.ts
function isObject(value) {
  return value !== null && typeof value === "object";
}
function hasInterest(node) {
  return node.subscribers > 0 || node.bindings.size > 0 || node.children.size > 0;
}
function readAtPath(root, segments) {
  if (root === void 0 || segments.length === 0) {
    return root;
  }
  let current = root;
  for (const segment of segments) {
    if (!isObject(current)) {
      return void 0;
    }
    current = current[segment];
  }
  return current;
}
function writeAtPath(root, segments, value) {
  if (segments.length === 0) {
    if (!isObject(value)) {
      return;
    }
    for (const key of Object.keys(root)) {
      delete root[key];
    }
    for (const key of Object.keys(value)) {
      root[key] = value[key];
    }
    return;
  }
  let current = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!isObject(current[segment])) {
      current[segment] = {};
    }
    current = current[segment];
  }
  current[segments[segments.length - 1]] = value;
}
function deleteAtPath(root, segments) {
  if (segments.length === 0) {
    for (const key of Object.keys(root)) {
      delete root[key];
    }
    return;
  }
  let current = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = current[segments[i]];
    if (!isObject(next)) {
      return;
    }
    current = next;
  }
  delete current[segments[segments.length - 1]];
}
var StateManager = class {
  constructor() {
    this.data = /* @__PURE__ */ new Map();
    this.interestRoots = /* @__PURE__ */ new Map();
    this.propagating = null;
    this.pendingReleases = null;
    this.pendingTransients = null;
    this.changedOnInterceptor = (fq, handler) => {
      if (this.changedEmitter.handlers.get(fq)?.has(handler)) {
        return;
      }
      this.ensureInterestNode(fq).subscribers++;
    };
    this.changedOffInterceptor = (fq, handler) => {
      const node = this.findInterestNode(fq);
      if (!node || !this.changedEmitter.handlers.get(fq)?.has(handler)) {
        return;
      }
      node.subscribers--;
      this.scheduleRelease(fq);
    };
    this.changedEmitter = new KeyedEventEmitter(this.changedOnInterceptor, this.changedOffInterceptor);
  }
  get changed() {
    return this.changedEmitter;
  }
  bind(target, source) {
    if (target === source) {
      return;
    }
    this.ensureInterestNode(target).bindings.add(source);
    this.ensureInterestNode(source).bindings.add(target);
    const seed = this.getValue(source);
    if (seed !== void 0) {
      this.applyEntry(target, seed);
    }
  }
  unbind(target, source) {
    this.findInterestNode(target)?.bindings.delete(source);
    this.findInterestNode(source)?.bindings.delete(target);
    this.scheduleRelease(target);
    this.scheduleRelease(source);
  }
  getValue(fqPropertyName) {
    return readAtPath(
      this.data.get(getComponentName(fqPropertyName)),
      getPropertySegments(getPropertyName(fqPropertyName))
    );
  }
  setValue(fqPropertyName, value) {
    if (Object.is(this.getValue(fqPropertyName), value)) {
      return;
    }
    this.applyEntry(fqPropertyName, value);
  }
  emitEvent(fqEventName, payload) {
    if (!this.pendingTransients) {
      this.pendingTransients = /* @__PURE__ */ new Set();
    }
    this.pendingTransients.add(fqEventName);
    this.applyEntry(fqEventName, payload);
  }
  applyEntry(fqPropertyName, value) {
    const outermost = this.propagating === null;
    if (outermost) {
      this.propagating = /* @__PURE__ */ new Set();
    }
    try {
      this.applyWrite(fqPropertyName, value);
    } finally {
      if (outermost) {
        this.propagating = null;
        const transients = this.pendingTransients;
        this.pendingTransients = null;
        if (transients) {
          for (const item of transients) {
            this.clearTransientData(item);
          }
        }
        const releases = this.pendingReleases;
        this.pendingReleases = null;
        if (releases) {
          for (const item of releases) {
            this.releaseIfUnused(item);
          }
        }
      }
    }
  }
  applyWrite(fqPropertyName, value) {
    if (this.propagating.has(fqPropertyName)) {
      return;
    }
    this.propagating.add(fqPropertyName);
    const component = getComponentName(fqPropertyName);
    const segments = getPropertySegments(getPropertyName(fqPropertyName));
    let root = this.data.get(component);
    if (!root) {
      root = {};
      this.data.set(component, root);
    }
    const ancestors = [];
    const subtree = [];
    const interestRoot = this.interestRoots.get(component);
    if (interestRoot) {
      let cursor = interestRoot;
      for (let i = 0; cursor && i < segments.length; i++) {
        if (cursor.subscribers > 0 || cursor.bindings.size > 0) {
          ancestors.push(cursor);
        }
        cursor = cursor.children.get(segments[i]) ?? null;
      }
      if (cursor) {
        const stack = [cursor];
        while (stack.length) {
          const node = stack.pop();
          if (node.subscribers > 0 || node.bindings.size > 0) {
            subtree.push(node);
          }
          for (const child of node.children.values()) {
            stack.push(child);
          }
        }
      }
    }
    const subtreeOldValues = new Array(subtree.length);
    for (let i = 0; i < subtree.length; i++) {
      subtreeOldValues[i] = readAtPath(root, subtree[i].segments);
    }
    writeAtPath(root, segments, value);
    for (let i = 0; i < subtree.length; i++) {
      const node = subtree[i];
      const newValue = readAtPath(root, node.segments);
      if (Object.is(subtreeOldValues[i], newValue)) {
        continue;
      }
      this.emitAt(node.fq, node, newValue, subtreeOldValues[i]);
    }
    for (const node of ancestors) {
      const currentValue = readAtPath(root, node.segments);
      this.emitAt(node.fq, node, currentValue, currentValue);
    }
  }
  emitAt(fq, node, newValue, oldValue) {
    if (node.subscribers > 0) {
      this.changedEmitter.emit(fq, newValue, oldValue);
    }
    for (const neighbor of node.bindings) {
      this.applyWrite(neighbor, newValue);
    }
  }
  clearTransientData(fqPropertyName) {
    const component = getComponentName(fqPropertyName);
    const root = this.data.get(component);
    if (!root) {
      return;
    }
    const segments = getPropertySegments(getPropertyName(fqPropertyName));
    deleteAtPath(root, segments);
    for (let depth = segments.length - 1; depth >= 1; depth--) {
      const parentSegments = segments.slice(0, depth);
      const parent = readAtPath(root, parentSegments);
      if (!isObject(parent) || Object.keys(parent).length > 0) {
        break;
      }
      deleteAtPath(root, parentSegments);
    }
    if (Object.keys(root).length === 0 && !this.interestRoots.has(component)) {
      this.data.delete(component);
    }
  }
  ensureInterestNode(fq) {
    const component = getComponentName(fq);
    const segments = getPropertySegments(getPropertyName(fq));
    let current = this.interestRoots.get(component);
    if (!current) {
      current = {
        parent: null,
        segment: "",
        segments: [],
        fq: joinFQPropertyName(component, ""),
        children: /* @__PURE__ */ new Map(),
        bindings: /* @__PURE__ */ new Set(),
        subscribers: 0
      };
      this.interestRoots.set(component, current);
    }
    for (const segment of segments) {
      let child = current.children.get(segment);
      if (!child) {
        const childSegments = [...current.segments, segment];
        child = {
          parent: current,
          segment,
          segments: childSegments,
          fq: joinFQPropertyName(component, childSegments.join(PROPERTY_NAME_SEGMENT_SEPARATOR)),
          children: /* @__PURE__ */ new Map(),
          bindings: /* @__PURE__ */ new Set(),
          subscribers: 0
        };
        current.children.set(segment, child);
      }
      current = child;
    }
    return current;
  }
  findInterestNode(fq) {
    const component = getComponentName(fq);
    const segments = getPropertySegments(getPropertyName(fq));
    let current = this.interestRoots.get(component);
    for (let i = 0; current && i < segments.length; i++) {
      current = current.children.get(segments[i]);
    }
    return current ?? null;
  }
  scheduleRelease(fq) {
    if (this.propagating !== null) {
      if (!this.pendingReleases) {
        this.pendingReleases = /* @__PURE__ */ new Set();
      }
      this.pendingReleases.add(fq);
      return;
    }
    this.releaseIfUnused(fq);
  }
  releaseIfUnused(fq) {
    const component = getComponentName(fq);
    const interestRoot = this.interestRoots.get(component);
    if (!interestRoot) {
      return;
    }
    let node = this.findInterestNode(fq);
    if (!node) {
      return;
    }
    const dataRoot = this.data.get(component);
    const pathStack = [...getPropertySegments(getPropertyName(fq))];
    while (node && node !== interestRoot && !hasInterest(node)) {
      const parent = node.parent;
      if (!parent) {
        break;
      }
      parent.children.delete(node.segment);
      if (dataRoot) {
        deleteAtPath(dataRoot, pathStack);
      }
      pathStack.pop();
      node = parent;
    }
    if (!hasInterest(interestRoot)) {
      this.interestRoots.delete(component);
      if (dataRoot && Object.keys(dataRoot).length === 0) {
        this.data.delete(component);
      }
    }
  }
};

// ../../runtime/hx-core/src/state/StateValueSource.ts
var StateValueSource = class {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.type = "state";
  }
  get(path) {
    return this.stateManager.getValue(path);
  }
};

// ../../runtime/hx-core/src/dictionaries/DictionaryValueSource.ts
var DictionaryValueSource = class {
  constructor(dictionaryDefinitionProvider) {
    this.dictionaryDefinitionProvider = dictionaryDefinitionProvider;
    this.type = "dictionary";
  }
  async get(path) {
    const splitIndex = path.lastIndexOf(DICTIONARY_ENTRY_SEPARATOR);
    const name = path.slice(0, splitIndex);
    const definition = await this.dictionaryDefinitionProvider.getDefinition(name);
    if (!definition) {
      throw new HeleonixError(Errors.dictionaryDefinitionProviding, name);
    }
    return definition.entries[path.slice(splitIndex + 1)];
  }
};

// ../../runtime/hx-core/src/bindings/Binder.ts
var EMPTY_ENDPOINTS = Object.freeze([]);
var Binder = class {
  constructor(stateManager, evaluator) {
    this.stateManager = stateManager;
    this.evaluator = evaluator;
    this.records = /* @__PURE__ */ new Map();
    this.edges = /* @__PURE__ */ new Map();
    this.endpointsByTarget = /* @__PURE__ */ new Map();
    this.endpointCounts = /* @__PURE__ */ new Map();
    this.endpointActivatedEmitter = new KeyedEventEmitter();
    this.endpointDeactivatedEmitter = new KeyedEventEmitter();
  }
  get endpointActivated() {
    return this.endpointActivatedEmitter;
  }
  get endpointDeactivated() {
    return this.endpointDeactivatedEmitter;
  }
  bind(targetFQ, binding2, scopeFQ) {
    this.unbind(targetFQ);
    if (!binding2.converters?.length) {
      if (binding2.type === "state") {
        return this.bindStateEdge(targetFQ, joinFQPropertyName(scopeFQ, binding2.value));
      }
      if (binding2.type === "literal") {
        return this.stateManager.setValue(targetFQ, JSON.parse(binding2.value));
      }
    }
    return this.bindReactive(targetFQ, binding2, scopeFQ);
  }
  unbind(targetFQ) {
    this.releaseEndpoints(targetFQ);
    const record = this.records.get(targetFQ);
    if (record) {
      for (const paramFQ of record.formatParams) {
        this.stateManager.changed.off(paramFQ, record.formatHandler);
      }
      if (record.parseHandler) {
        this.stateManager.changed.off(record.targetFQ, record.parseHandler);
      }
      this.records.delete(targetFQ);
      return;
    }
    const edgeSource = this.edges.get(targetFQ);
    if (edgeSource !== void 0) {
      this.stateManager.unbind(targetFQ, edgeSource);
      this.edges.delete(targetFQ);
    }
  }
  rebind(targetFQ, binding2, scopeFQ) {
    if (this.evaluator.isDimensionSensitive(binding2)) {
      void this.bind(targetFQ, binding2, scopeFQ);
    }
  }
  getActiveEndpoints(componentFQ) {
    const paths = this.endpointCounts.get(componentFQ);
    return paths ? [...paths.keys()] : EMPTY_ENDPOINTS;
  }
  bindStateEdge(targetFQ, sourceFQ) {
    this.stateManager.bind(targetFQ, sourceFQ);
    this.edges.set(targetFQ, sourceFQ);
    this.registerEndpoints(targetFQ, [targetFQ, sourceFQ]);
  }
  registerEndpoints(targetFQ, endpoints) {
    this.endpointsByTarget.set(targetFQ, endpoints);
    for (const endpoint of endpoints) {
      const localPath = getPropertyName(endpoint);
      if (!localPath) {
        continue;
      }
      const componentFQ = getComponentName(endpoint);
      let paths = this.endpointCounts.get(componentFQ);
      if (!paths) {
        paths = /* @__PURE__ */ new Map();
        this.endpointCounts.set(componentFQ, paths);
      }
      const count = paths.get(localPath) ?? 0;
      paths.set(localPath, count + 1);
      if (count === 0) {
        this.endpointActivatedEmitter.emit(componentFQ, localPath);
      }
    }
  }
  releaseEndpoints(targetFQ) {
    const endpoints = this.endpointsByTarget.get(targetFQ);
    if (!endpoints) {
      return;
    }
    this.endpointsByTarget.delete(targetFQ);
    for (const endpoint of endpoints) {
      const localPath = getPropertyName(endpoint);
      const componentFQ = getComponentName(endpoint);
      const paths = this.endpointCounts.get(componentFQ);
      const count = paths?.get(localPath);
      if (!paths || !count) {
        continue;
      }
      if (count > 1) {
        paths.set(localPath, count - 1);
        continue;
      }
      paths.delete(localPath);
      if (paths.size === 0) {
        this.endpointCounts.delete(componentFQ);
      }
      this.endpointDeactivatedEmitter.emit(componentFQ, localPath);
    }
  }
  bindReactive(targetFQ, binding2, scopeFQ) {
    return thenMaybe(
      this.evaluator.collectParameters(binding2, scopeFQ),
      (params) => this.startRecord(this.createRecord(targetFQ, binding2, scopeFQ, params))
    );
  }
  createRecord(targetFQ, binding2, scopeFQ, params) {
    const sourceFQ = binding2.type === "state" && binding2.value ? joinFQPropertyName(scopeFQ, binding2.value) : void 0;
    const record = {
      binding: binding2,
      scopeFQ,
      targetFQ,
      formatParams: params,
      sourceFQ,
      skipUndefined: binding2.type !== "state" && binding2.type !== "literal",
      writing: false,
      formatHandler: () => this.runFormat(record),
      parseHandler: sourceFQ !== void 0 ? () => this.runParse(record) : void 0
    };
    return record;
  }
  startRecord(record) {
    for (const paramFQ of record.formatParams) {
      this.stateManager.changed.on(paramFQ, record.formatHandler);
    }
    if (record.parseHandler) {
      this.stateManager.changed.on(record.targetFQ, record.parseHandler);
    }
    this.records.set(record.targetFQ, record);
    this.registerEndpoints(record.targetFQ, [record.targetFQ, ...record.formatParams]);
    return this.format(record);
  }
  runFormat(record) {
    try {
      void this.format(record);
    } catch (error) {
      void Promise.resolve().then(() => {
        throw error;
      });
    }
  }
  runParse(record) {
    try {
      void this.parse(record);
    } catch (error) {
      void Promise.resolve().then(() => {
        throw error;
      });
    }
  }
  format(record) {
    if (record.writing) {
      return;
    }
    const value = this.evaluator.resolve(record.binding, record.scopeFQ);
    if (isThenable(value)) {
      return value.then((resolved) => this.writeFormatted(record, resolved));
    }
    this.writeFormatted(record, value);
  }
  writeFormatted(record, value) {
    if (record.skipUndefined && value === void 0) {
      return;
    }
    this.write(record, record.targetFQ, value);
  }
  parse(record) {
    const sourceFQ = record.sourceFQ;
    if (record.writing || sourceFQ === void 0) {
      return;
    }
    const value = this.evaluator.resolveBack(
      this.stateManager.getValue(record.targetFQ),
      record.binding,
      record.scopeFQ
    );
    if (isThenable(value)) {
      return value.then((resolved) => this.write(record, sourceFQ, resolved));
    }
    this.write(record, sourceFQ, value);
  }
  write(record, fq, value) {
    record.writing = true;
    this.stateManager.setValue(fq, value);
    record.writing = false;
  }
};

// ../../runtime/hx-core/src/bindings/BindingEvaluator.ts
var EXPRESSION_REGEX = new RegExp(EXPRESSION_PATTERN, "g");
var EMPTY_ARGS = Object.freeze({});
var LEAF_TYPES = /* @__PURE__ */ new Set(["state", "literal"]);
var BindingEvaluator = class {
  constructor(converters, sources) {
    this.converters = converters;
    this.argEntries = /* @__PURE__ */ new WeakMap();
    this.sources = new Map(sources.map((source) => [source.type, source]));
  }
  resolve(binding2, scopeFQ) {
    return this.applyFormat(this.resolveSource(binding2, scopeFQ), binding2.converters ?? [], 0, scopeFQ);
  }
  resolveBack(targetValue, binding2, scopeFQ) {
    const converters = binding2.converters ?? [];
    return this.applyParse(targetValue, converters, converters.length - 1, scopeFQ);
  }
  collectParameters(binding2, scopeFQ) {
    const params = /* @__PURE__ */ new Set();
    return thenMaybe(this.collectInto(binding2, scopeFQ, params), () => [...params]);
  }
  isDimensionSensitive(binding2) {
    if (binding2.type === "dictionary" || binding2.type === "config") {
      return true;
    }
    for (const segment of binding2.converters ?? []) {
      for (const expression of Object.values(parseConverterCall(segment).args)) {
        if (expression.type === "dictionary" || expression.type === "config") {
          return true;
        }
      }
    }
    return false;
  }
  applyFormat(value, converters, index, scopeFQ) {
    while (index < converters.length) {
      if (isThenable(value)) {
        const next2 = index;
        return value.then((source2) => this.applyFormat(source2, converters, next2, scopeFQ));
      }
      const call = parseConverterCall(converters[index]);
      const args = this.resolveArgs(call, scopeFQ);
      const source = value;
      const next = index + 1;
      if (isThenable(args)) {
        return args.then(
          (resolved) => this.applyFormat(this.converters.get(call.name).format(source, resolved), converters, next, scopeFQ)
        );
      }
      value = this.converters.get(call.name).format(source, args);
      index = next;
    }
    return value;
  }
  applyParse(value, converters, index, scopeFQ) {
    while (index >= 0) {
      if (isThenable(value)) {
        const next2 = index;
        return value.then((target2) => this.applyParse(target2, converters, next2, scopeFQ));
      }
      const call = parseConverterCall(converters[index]);
      const args = this.resolveArgs(call, scopeFQ);
      const target = value;
      const next = index - 1;
      if (isThenable(args)) {
        return args.then(
          (resolved) => this.applyParse(this.converters.get(call.name).parse(target, resolved), converters, next, scopeFQ)
        );
      }
      value = this.converters.get(call.name).parse(target, args);
      index = next;
    }
    return value;
  }
  resolveSource(expression, scopeFQ) {
    const source = this.sources.get(expression.type);
    if (!source) {
      return void 0;
    }
    const raw = source.get(this.pathFor(expression, scopeFQ));
    return LEAF_TYPES.has(expression.type) ? raw : this.interpolateMaybe(raw, scopeFQ);
  }
  interpolateMaybe(raw, scopeFQ) {
    if (isThenable(raw)) {
      return raw.then((value) => this.interpolateMaybe(value, scopeFQ));
    }
    return typeof raw === "string" ? this.interpolate(raw, scopeFQ) : raw;
  }
  async interpolate(template, scopeFQ) {
    let result = "";
    let lastIndex = 0;
    for (const match of template.matchAll(EXPRESSION_REGEX)) {
      result += template.slice(lastIndex, match.index);
      result += String(await this.resolve(parseBindingExpression(match[1]), scopeFQ));
      lastIndex = match.index + match[0].length;
    }
    return result + template.slice(lastIndex);
  }
  collectInto(expression, scopeFQ, params) {
    let sourcePart = void 0;
    if (expression.type === "state") {
      if (expression.value) {
        params.add(joinFQPropertyName(scopeFQ, expression.value));
      }
    } else if (!LEAF_TYPES.has(expression.type)) {
      const source = this.sources.get(expression.type);
      if (source) {
        sourcePart = this.collectFromTemplate(source.get(this.pathFor(expression, scopeFQ)), scopeFQ, params);
      }
    }
    return thenMaybe(sourcePart, () => this.collectArgs(expression, scopeFQ, params));
  }
  collectFromTemplate(raw, scopeFQ, params) {
    if (isThenable(raw)) {
      return raw.then((value) => this.collectFromTemplate(value, scopeFQ, params));
    }
    if (typeof raw !== "string") {
      return void 0;
    }
    let chain = void 0;
    for (const match of raw.matchAll(EXPRESSION_REGEX)) {
      const inner = match[1];
      chain = thenMaybe(chain, () => this.collectInto(parseBindingExpression(inner), scopeFQ, params));
    }
    return chain;
  }
  collectArgs(expression, scopeFQ, params) {
    let chain = void 0;
    for (const segment of expression.converters ?? []) {
      for (const argExpression of Object.values(parseConverterCall(segment).args)) {
        chain = thenMaybe(chain, () => this.collectInto(argExpression, scopeFQ, params));
      }
    }
    return chain;
  }
  pathFor(expression, scopeFQ) {
    return expression.type === "state" ? joinFQPropertyName(scopeFQ, expression.value) : expression.value;
  }
  resolveArgs(call, scopeFQ) {
    let entries = this.argEntries.get(call);
    if (entries === void 0) {
      entries = Object.entries(call.args);
      this.argEntries.set(call, entries);
    }
    if (entries.length === 0) {
      return EMPTY_ARGS;
    }
    const args = {};
    let pending;
    for (const [name, expression] of entries) {
      const value = this.resolveSource(expression, scopeFQ);
      if (isThenable(value)) {
        ;
        (pending ??= []).push(value.then((resolved) => void (args[name] = resolved)));
      } else {
        args[name] = value;
      }
    }
    return pending ? Promise.all(pending).then(() => args) : args;
  }
};

// ../../runtime/hx-core/src/bindings/LiteralValueSource.ts
var LiteralValueSource = class {
  constructor() {
    this.type = "literal";
  }
  get(path) {
    return JSON.parse(path);
  }
};

// ../../runtime/hx-core/src/converters/ConverterRegistry.ts
var ConverterRegistry = class {
  constructor(converterCtors, context) {
    this.converterCtors = converterCtors;
    this.context = context;
    this.instances = /* @__PURE__ */ new Map();
  }
  get(name) {
    let instance = this.instances.get(name);
    if (!instance) {
      const ctor = this.converterCtors.get(name);
      if (!ctor) {
        throw new HeleonixError(Errors.unknownConverter, name);
      }
      instance = new ctor(this.context());
      this.instances.set(name, instance);
    }
    return instance;
  }
};

// ../../runtime/hx-core/src/configs/ConfigValueSource.ts
var ConfigValueSource = class {
  constructor(configDefinitionProvider) {
    this.configDefinitionProvider = configDefinitionProvider;
    this.type = "config";
  }
  async get(path) {
    const splitIndex = path.lastIndexOf(CONFIG_ENTRY_SEPARATOR);
    const name = path.slice(0, splitIndex);
    const definition = await this.configDefinitionProvider.getDefinition(name);
    if (!definition) {
      throw new HeleonixError(Errors.configDefinitionProviding, name);
    }
    return definition.entries[path.slice(splitIndex + 1)];
  }
};

// ../../runtime/hx-core/src/converters/Converter.ts
var Converter = class {
  constructor(context) {
    this.context = context;
  }
};

// perf/harness.ts
var FakeConfigDefinitionProvider = class {
  getDefinition() {
    return Promise.resolve(void 0);
  }
};
var FakeDictionaryDefinitionProvider = class {
  getDefinition() {
    return Promise.resolve(void 0);
  }
};
var SyncConverter = class extends Converter {
  format(value, params) {
    return Number(value) * params.factor;
  }
  parse(value, params) {
    return Number(value) / params.factor;
  }
};
var AsyncConverter = class extends Converter {
  format(value, params) {
    return Promise.resolve(Number(value) * params.factor);
  }
  parse(value, params) {
    return Promise.resolve(Number(value) / params.factor);
  }
};
var BareConverter = class extends Converter {
  format(value) {
    return Number(value) + 1;
  }
  parse(value) {
    return Number(value) - 1;
  }
};
function makeGraph() {
  const state = new StateManager();
  const converterRegistry = new ConverterRegistry(
    /* @__PURE__ */ new Map([
      ["Sync", SyncConverter],
      ["Async", AsyncConverter],
      ["Bare", BareConverter]
    ]),
    () => ({})
  );
  const evaluator = new BindingEvaluator(converterRegistry, [
    new StateValueSource(state),
    new LiteralValueSource(),
    new ConfigValueSource(new FakeConfigDefinitionProvider()),
    new DictionaryValueSource(new FakeDictionaryDefinitionProvider())
  ]);
  return { state, binder: new Binder(state, evaluator), evaluator };
}
function heapUsedMb() {
  const g = globalThis.gc;
  g?.();
  g?.();
  return process.memoryUsage().heapUsed / (1024 * 1024);
}
var binding = (value, converter) => ({
  type: "state",
  value,
  converters: [`${converter}(factor: 2)`]
});
async function benchResolve(iterations, expr) {
  const { evaluator, state } = makeGraph();
  state.setValue(joinFQPropertyName("app", "v"), 21);
  for (let i = 0; i < 2e4; i++) {
    const value = evaluator.resolve(expr, "app");
    if (isThenable(value)) await value;
  }
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const value = evaluator.resolve(expr, "app");
    if (isThenable(value)) await value;
  }
  return performance.now() - start;
}
async function benchRecompute(iterations, converter) {
  const { state, binder } = makeGraph();
  const source = joinFQPropertyName("app", "src");
  state.setValue(source, 1);
  await binder.bind("view:out", binding("src", converter), "app");
  for (let i = 0; i < 2e4; i++) {
    state.setValue(source, i);
  }
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    state.setValue(source, i + 1e6);
  }
  return performance.now() - start;
}
async function benchBind(count, makeBinding) {
  const { state, binder } = makeGraph();
  for (let i = 0; i < count; i++) {
    state.setValue(joinFQPropertyName("app", `v${i}`), i);
  }
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const result = binder.bind(`C${i}:out`, makeBinding(i), "app");
    if (isThenable(result)) await result;
  }
  return performance.now() - start;
}
async function benchHeap(count, converter) {
  const { state, binder } = makeGraph();
  for (let i = 0; i < count; i++) {
    state.setValue(joinFQPropertyName("app", `v${i}`), i);
  }
  const before = heapUsedMb();
  for (let i = 0; i < count; i++) {
    await binder.bind(`C${i}:out`, binding(`v${i}`, converter), "app");
  }
  const after = heapUsedMb();
  if (binder.constructor.name === "") {
    console.log(state);
  }
  return after - before;
}
async function main() {
  const RESOLVE = 3e5;
  const RECOMPUTE = 3e5;
  const BIND = 2e4;
  const HEAP = 2e4;
  const resolveAsyncMs = await benchResolve(RESOLVE, binding("v", "Async"));
  const resolveSyncMs = await benchResolve(RESOLVE, binding("v", "Sync"));
  const resolveBareMs = await benchResolve(RESOLVE, { type: "state", value: "v", converters: ["Bare"] });
  const recomputeSyncMs = await benchRecompute(RECOMPUTE, "Sync");
  const bindEdgeMs = await benchBind(BIND, (i) => ({ type: "state", value: `v${i}` }));
  const bindSyncMs = await benchBind(BIND, (i) => binding(`v${i}`, "Sync"));
  const bindAsyncMs = await benchBind(BIND, (i) => binding(`v${i}`, "Async"));
  const heapMb = await benchHeap(HEAP, "Sync");
  const per = (ms, n) => `${(ms / n * 1e3).toFixed(3)} \xB5s`;
  const rows = [
    ["resolve ASYNC converter (await)", per(resolveAsyncMs, RESOLVE), `${resolveAsyncMs.toFixed(0)} ms`],
    ["resolve SYNC converter (1 arg)", per(resolveSyncMs, RESOLVE), `${resolveSyncMs.toFixed(0)} ms`],
    ["resolve BARE converter (no args)", per(resolveBareMs, RESOLVE), `${resolveBareMs.toFixed(0)} ms`],
    ["recompute SYNC (state\u2192format\u2192write)", per(recomputeSyncMs, RECOMPUTE), `${recomputeSyncMs.toFixed(0)} ms`],
    ["bind: state edge (sync)", per(bindEdgeMs, BIND), `${bindEdgeMs.toFixed(0)} ms`],
    ["bind: sync converter (sync)", per(bindSyncMs, BIND), `${bindSyncMs.toFixed(0)} ms`],
    ["bind: async converter (await)", per(bindAsyncMs, BIND), `${bindAsyncMs.toFixed(0)} ms`],
    ["heap (sync)", `${(heapMb * 1024 * 1024 / HEAP).toFixed(0)} B/binding`, `${heapMb.toFixed(1)} MB`]
  ];
  console.log("\n metric                              | per-unit        | total");
  console.log(" ------------------------------------|-----------------|--------");
  for (const [metric, unit, total] of rows) {
    console.log(` ${metric.padEnd(35)}| ${unit.padEnd(16)}| ${total}`);
  }
  console.log(
    `
JSON ${JSON.stringify({ resolveAsyncMs, resolveSyncMs, resolveBareMs, recomputeSyncMs, bindEdgeMs, bindSyncMs, bindAsyncMs, heapMb })}`
  );
}
void main();
