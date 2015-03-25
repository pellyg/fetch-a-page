App = Backbone.Model.extend({
  updateFetchedPage: function(data) {
    var dom = $.parseHTML(data);
    this.attributes['dom'] = dom;
    this.trigger('dom_updated')
    this.on('tag_clicked', function(e) {
      this.trigger('highlight_markup', e)
    }.bind(this));
  }
});

TagView = Backbone.View.extend({
  
  initialize: function (model) {
    this.$el = $('#tags');
    this.model = model;
    this.model.on('dom_updated', this.populate.bind(this));
  },

  getTagsFromDom: function(data) {
    if (!data) {
      return {};
    }
    var tagMap = {}
    $.each(data, function (index, tag) {
      if (tag.nodeType == Node.COMMENT_NODE) {
        return;
      }
      if (tag.nodeType != Node.TEXT_NODE) {
        var tagName = tag.tagName;
        if (typeof tagMap[tagName] == 'undefined') {
          tagMap[tagName] = 0
        }
        tagMap[tagName] += 1;
        if (tag.childNodes.length > 0) {
          var recursive = this.getTagsFromDom(tag.childNodes);
          $.each(recursive, function(k, v) {
            if (typeof tagMap[k] == 'undefined') {
              tagMap[k] = 0;  
            };
            tagMap[k] += recursive[k];
          }.bind(this));
        }
      }
    }.bind(this));
    return tagMap;
  },

  populate: function(){
    var tagMap = this.getTagsFromDom(this.model.get('dom'));
    var content = $('<ul></ul>');
    $.each(Object.keys(tagMap).sort(), function (i, tagName) {
      var count = tagMap[tagName];
      // console.log(tagName, count)
      tagName = tagName.toLowerCase();
      var bullet = $("<li></li>");
      bullet.append('<a class="tag-list" href="#tag-' + tagName + '">' + tagName + ' (' + count + ')</a>');
      bullet.on('click', function(e) {
        this.model.trigger('tag_clicked', tagName)
      }.bind(this));
      bullet.appendTo(content);
    }.bind(this));
    this.$el.empty().html(content)
  },
  
  render: function() {
    this.model.on('dom_updated', this.populate.bind(this));
    return this;
  }
})

MarkupView = Backbone.View.extend({
  initialize: function (model) {
    this.$el = $('#markup');
    console.log('markup view created')
    this.model = model;
    this.model.on('dom_updated', this.populate.bind(this));
    this.model.on('highlight_markup', this.selectTag.bind(this));
  },
  applyHighlightClass: function(dom) {
    el = $(dom)
    highlightClass = "tag-" + this.model.get('highlightTag')
    if (el.hasClass(highlightClass)) {
      el.removeClass('normal')
      el.addClass('highlight')
    } else {
      el.removeClass('highlight')
      el.addClass('normal')
    }
  },

  selectTag: function(tagName, dom) {
    if (!dom) {
      dom = [this.$el]; // base case
    }
    $.each(dom, function (index, elt) {
      this.model.set('highlightTag', tagName)
      this.applyHighlightClass(elt);
      var childNodes = $(elt).children();
      if (childNodes) {        
        this.selectTag(tagName, childNodes);
      }
    }.bind(this));
  },

  cssClassesFor: function(tagName) {
    if (this.model.get('highlightTag') == tagName) {
      return 'highlight tag-' + tagName;
    } else {
      return 'normal tag-' + tagName;
    }
  },

  wrapInADiv: function(dom, contents) {
    var highlightTag = this.model.get('highlightTag');
    var newDom;
    $.each(dom, function(index, elt) {
      if (elt.nodeType == Node.COMMENT_NODE || (!(elt.outerHTML || elt[0].outerHTML))) {
        return;
      }
      tagName = (elt.tagName || "").toLowerCase();
      var tagClass = this.cssClassesFor(tagName, highlightTag);

      // return a 2-elt array with open and close tags, minus the <>.
      var tagOpenClose = $.grep(elt.outerHTML.split(/[><]/g), function(elt) { return (elt !== "") });
  
      var markup = $('<div class="' + tagClass + '"></div>');
      markup.append($('<a name="tag-' + tagName+'"></a>'));
      markup.append("&lt;" + tagOpenClose[0] + "&gt;");
      markup.append(contents);
      if (tagOpenClose[1]) {
        markup.append("&lt;" + tagOpenClose[1] + "&gt;");
      }
      if (newDom == null) {
        newDom = $(markup);
      } else {
        newDom.append($(markup));
      }
    }.bind(this));
    return newDom;
  },

  createOrAppend: function(retval, elt) {
    if (retval == null) {
      retval = $(elt);
    } else {
      retval.append($(elt));
    }
  },

  annotated_dom: function(dom) {
    var retval;

    if (!dom || dom.length == 0) {
      return null;
    }
    $(dom).each(function(index, tag) {
      if (typeof tag == "undefined") {
        return;
      }

      if (tag.nodeType == Node.TEXT_NODE) {
        if (retval == null) {
          retval = $('<p></p>').append(tag);
        }
      } else {
        var recursiveCall = this.annotated_dom(tag.childNodes);
        var wrappedElement = this.wrapInADiv($(tag).clone().empty(), recursiveCall);
        this.createOrAppend(retval, $(wrappedElement));
      }
    }.bind(this));
    return retval;
  },

  populate: function(highlightTag) {
    var data = this.annotated_dom(this.model.get('dom'));
    if (!data) {
      return;
    }
    var content = $('<div class="content"></div>').append(data);
    this.$el.empty().append(content);
  },

  render: function() {
    this.model.on('dom_updated', this.populate.bind(this))
    this.model.on('tag_clicked', this.selectTag.bind(this));
    this.populate();
    return this;
  }
})

AppView = Backbone.View.extend({ 
  el: '#url-fetch',

  initialize: function (model) {
    this.model = model;
    this.tagView = new TagView(model);
    this.markupView = new MarkupView(model);
    this.urlToFetch = $('#url');
    this.icon = $('#icon');
    this.proxyUrl = '/proxy';
    this.requestedUrl = $('#url');
    

  },

  events: {
    'submit #this-is-ze-form': 'urlChanged',
  },
  
  onUrlFetchSuccess: function(data) {
    this.updateFavicon();
    this.model.updateFetchedPage(data);
  },

  // if we get an error, then do the normal routine with the error page markup.
  onUrlFetchError: function(data) {
    console.log('onUrlFetchError')
    this.model.updateFetchedPage(data.responseText)
  },

  // vanity image update
  updateFavicon: function() {
    var host = this.getHostname(this.urlToFetch.val());
    $(this.icon).attr('src', host + "/favicon.ico");
  },

  getHostname: function(url) {
    var m = url.match(/^https?:\/\/[^/]+/);
    return m ? m[0] : null;
  },

  urlChanged: function (x) {
    var url = this.requestedUrl.val();
    if (url.indexOf('http') < 0) {
      url = "http://" + url;
      this.requestedUrl.val(url);
    }

    console.debug("retrieving url", url);

    $.get(this.proxyUrl + "?url=" + url).
      success(this.onUrlFetchSuccess.bind(this)).
      error(this.onUrlFetchError.bind(this));
    return false;
  }
});

appView = new AppView(new App());