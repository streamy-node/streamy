class ContentController {
  constructor() {
    if (this.constructor === ContentController) {
      throw new TypeError(
        'Abstract class "ContentController" cannot be instantiated directly'
      );
    }

    this.isInitialized = false;
  }

  /**
   * This method is called only once when at the first render call
   * OVERRIDABLE
   */
  _initialize() {}

  /**
   * This method should render your content into target jQuery element
   * OVERRIDABLE
   */
  _render(target) {
    throw new Error("You must implement the _render function");
  }

  /**
   * Render controller content in target jQuery element.
   * DO NOT OVERRIDE, override _render instead
   */
  render(target) {
    if (!this.isInitialized) {
      this._initialize();
      this.isInitialized = true;
    }
    this._render(target);
  }
}
