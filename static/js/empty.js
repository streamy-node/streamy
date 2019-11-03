class EmptyContent {
  constructor(templates, langs) {
    this.langs = langs;
  }

  render(target) {
    $(target).html('<div id="">Work in progress</div>');
  }
}
