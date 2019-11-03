class InfiniteScroll {
  setup(scrollElem, scrollContent, batchLength, addMoreCallback) {
    this.batchLength = batchLength;
    this.preloadSize = scrollElem.height() * 3;
    this.lastOffset = 0;
    this.endReached = false;
    this.queryOngoing = false;
    var self = this;
    this.lastOffsetReq = -1;

    var deviceAgent = navigator.userAgent.toLowerCase();
    this.agentID = deviceAgent.match(/(iphone|ipod|ipad)/);

    this.addMore = function(results, initial = false) {
      //console.log("scrollTop "+scrollElem.scrollTop()+" height:"+scrollElem.height()+" $(document).height()"+scrollContent.height())
      self.queryOngoing = false;
      self.lastOffset += results;

      //Cancel duplicate call from scroll
      if (self.lastOffsetReq >= self.lastOffset) {
        return;
      }

      if (!initial && results < self.batchLength) {
        self.endReached = true;
        //console.log("No more content");
        return;
      }

      if (
        (scrollElem.scrollTop() + scrollElem.height() >
          scrollContent.height() - self.preloadSize &&
          (initial || results > 0)) ||
        (self.agentID &&
          scrollElem.scrollTop() + scrollElem.height() + 150 >
            scrollContent.height() - self.preloadSize)
      ) {
        //console.log("Last offset "+self.lastOffset)
        self.lastOffsetReq = self.lastOffset;
        addMoreCallback(self.batchLength, self.lastOffset, self.addMore);
      }
    };

    scrollElem.scroll(function() {
      if (self.endReached) {
        return;
      }
      self.queryOngoing = true;
      self.addMore(0, true);
    });

    this.addMore(0, true);
  }
}
