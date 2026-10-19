// jsdom stand-ins that React Flow needs to mount and render nodes.
// Based on https://reactflow.dev/learn/advanced-use/testing

class ResizeObserverStub {
  private targets = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.targets.add(target);
    const { offsetWidth: width, offsetHeight: height } = target instanceof HTMLElement ? target : { offsetWidth: 1, offsetHeight: 1 };
    const contentRect = { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) };
    const entry: ResizeObserverEntry = {
      target,
      contentRect,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    };
    // Browser observers fire after mount, once React Flow has registered its viewport.
    requestAnimationFrame(() => {
      if (this.targets.has(target)) this.callback([entry], this);
    });
  }
  unobserve(target: Element) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
}

class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}

export function stubReactFlowDom() {
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, configurable: true });
  Object.defineProperty(globalThis, 'DOMMatrixReadOnly', { value: DOMMatrixReadOnlyStub, configurable: true });
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 1;
      },
    },
  });
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
}
