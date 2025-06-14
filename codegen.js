import { Config } from './config.js';

const random = $fx.rand;
const choice = (from) => from[random() * from.length | 0];
// Float format and quantization.
const ff = (n) => {
  const res = (n * 10000.0 | 0) / 10000.0 + '';
  if (res.indexOf('.') === -1) {
    return res + '.0';
  }
  return res;
};

let VARS = ['x', 'y', 'p', 'q', 'tt'];

class AConst {
  constructor(val) {
    this.val = val;
  }
  print() {
    return `${ff(this.val)}`;
  }
  dependencies() {
    return new Set([]);
  }
  depth() {
    return 1;
  }
  static random(depth=0) {
    return new AConst((random() - 0.5) * 2.0);
  }
}

class AVar {
  constructor(name) {
    this.name = name;
  }
  print() {
    return this.name;
  }
  dependencies() {
    return new Set([this.name]);
  }
  depth() {
    return 1;
  }
  static random(depth=0) {
    return new AVar(choice(VARS));
  }
}

const ARITHMETIC_OPS = ['+', '-', '*', '/'];
class AOp {
  constructor(left_term, right_term, op) {
    this.left_term = left_term;
    this.right_term = right_term;
    this.op = op;
  }
  print() {
    return `(${this.left_term.print()} ${this.op} ${this.right_term.print()})`;
  }
  dependencies() {
    return new Set(
      [...this.left_term.dependencies(),
       ...this.right_term.dependencies()]);
  }
  depth() {
    return Math.max(
      this.left_term.depth(), this.right_term.depth()) + 1;
  }
  static random(depth=0) {
    return new AOp(
      AExpr.random(depth + 1),
      AExpr.random(depth + 1),
      choice(Object.values(ARITHMETIC_OPS)));
  }
}

class ASimpleOp {
  constructor(left_term, right_term, op) {
    this.left_term = left_term;
    this.right_term = right_term;
    this.op = op;
  }
  print() {
    return `(${this.left_term.print()} ${this.op} ${this.right_term.print()})`;
  }
  dependencies() {
    return new Set(
      [...this.left_term.dependencies(),
       ...this.right_term.dependencies()]);
  }
  depth() {
    return Math.max(
      this.left_term.depth(), this.right_term.depth()) + 1;
  }
  static random(depth=0) {
    return new AOp(
      ASimpleExpr.random(depth + 1),
      ASimpleExpr.random(depth + 1),
      choice(Object.values(ARITHMETIC_OPS)));
  }
}

class AMath {
  constructor(func, args) {
    this.func = func;
    this.args = args;
    this.value = random() > 0.5 ? 1.0 : -1.0;
  }
  print() {
    const print_args = () => this.args.map(a =>  `${a.expr.print()}`);
    // const print_args = () => this.args.map(a =>
    //     `clamp(${a.expr.print()}, ${ff(a.clamp[0])}, ${ff(a.clamp[1])})`);
    const printed_args = print_args();

    // if (this.func === 'noise') {
    //   return `${this.func}(vec2(${printed_args[0]}, ${printed_args[1]}))`;
    // }
    if (this.func === 'dot') {
      return `${this.func}(vec2(${printed_args[0]}, ${printed_args[1]}),
        vec2(${printed_args[2]}, ${printed_args[3]}))`;
    }
    if (this.func === 'mod') {
      return `${this.func}(${printed_args[0]} > 0.0 ? ${printed_args[0]} : -(${printed_args[0]}),
      ${printed_args[1]} > 0.0 ? 
        max(${printed_args[1]}, 1.0)
        : -(
        max(${printed_args[1]}, 1.0)
        ))`;
    }
    if (this.func === 'mix') {
      return `${this.func}((${printed_args[0]}),
        (${printed_args[0]} + ${printed_args[1]}), ${printed_args[2]})`;
    }
    if (this.func === 'sin' || this.func === 'cos') {
      return `${this.func}(${ff(this.value)} * ${printed_args[0]})`;
    }

    return `${this.func}(${printed_args.join(', ')})`;
  }
  dependencies() {
    const deps = [];
    for (const arg of Object.values(this.args)) {
      deps.push(...arg.expr.dependencies());
    }
    return new Set(deps);
  }
  depth() {
    return Math.max(...
      this.args.map(a => a.expr.depth())) + 1;
  }
  static random(depth=0) {
    const funcs = {...FUNCS};
    const [func, info] = choice(Object.entries(funcs));

    const args = [];
    for (let i = 0; i < info.params; ++i) {
      const types = info.arg_types[i];

      const makeArg = (i) => {
        while (true) {
          const expr = choice(types).random(depth + 1);
          // Do not depend on t in mod second argument.
          // const deps = expr.dependencies();
          // if (func === 'mod' && i == 1 && 
          //     (deps.has('p') || deps.has('q')) ) {
          //   continue;
          // }
          // if (!deps.has('x') && !deps.has('y')) {
          //   continue;
          // }
          return expr;
        }
      }

      args.push({expr: makeArg()});
    }
    return new AMath(func, args);
  }
}

class AExpr {
  static random(depth=0, doMath=true) {
    const choices = [AConst, AVar, AOp];
    if (doMath) {
      choices.push(AMath);
    }
    if (depth < Config.min_expr_depth) {
      choices.push(AExpr);
    }
    return choice(choices).random(depth + 1);
  }
}

class ASimpleExpr {
  static random(depth=0) {
    const choices = [AConst, AVar, ASimpleOp];
    return choice(choices).random(depth + 1);
  }
}

export const BuildProgram = () => {
  VARS = ['x', 'y', 'p', 'q', 'tt'];
  const make = () => {
    while (true) {
      const expr = AExpr.random(0);
      if (expr.depth() < Config.min_depth) {
        continue;
      }
      return expr;
    }
  };

  const p0 = make();

  return `
    v0 = ${p0.print()};
  `;
};

export const BuildColorProgram = () => {
  VARS = ['v0', 'v1', 'v2', 'v3', 'v4'];
  const make = () => {
    while (true) {
      const expr = ASimpleExpr.random(0);
      return expr;
    }
  };

  const r = make();
  const g = make();
  const b = make();

  return `
    r = ${r.print()};
    g = ${g.print()};
    b = ${b.print()};
  `;
}

const ALL_ARGS = [AVar, AConst, AExpr];

const FUNCS = {};
FUNCS['sin'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
FUNCS['cos'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
FUNCS['tan'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
FUNCS['sign'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
FUNCS['fract'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
FUNCS['exp'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
FUNCS['atan'] = {
  params: 2,
  arg_types: [ALL_ARGS, ALL_ARGS],
};
FUNCS['mod'] = {
  params: 2,
  arg_types: [ALL_ARGS, ALL_ARGS],
};
FUNCS['min'] = {
  params: 2,
  arg_types: [ALL_ARGS, ALL_ARGS],
};
FUNCS['max'] = {
  params: 2,
  arg_types: [ALL_ARGS, ALL_ARGS],
};
FUNCS['pow'] = {
  params: 2,
  arg_types: [ALL_ARGS, ALL_ARGS],
};
FUNCS['mix'] = {
  params: 3,
  arg_types: [ALL_ARGS, ALL_ARGS, ALL_ARGS],
};
FUNCS['dot'] = {
  params: 4,
  arg_types: [ALL_ARGS, ALL_ARGS, ALL_ARGS, ALL_ARGS],
};
