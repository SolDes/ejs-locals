const ejs = require('ejs'),
      path = require('path'),
      fs = require('fs'),
      exists = fs.existsSync || path.existsSync,
      extname = path.extname,
      join = path.join;

function compile(file, options, cb) {
  // Express used to set options.locals for us, but now we do it ourselves
  // (EJS does some __proto__ magic to expose these funcs/values in the template)
  if (!options.locals) {
    options.locals = {};
  }

  options.__proto__ = options.locals;

  if (!options.locals.blocks) {
    // one set of blocks no matter how often we recurse
    const blocks = { scripts: new Block(), stylesheets: new Block() };
    options.locals.blocks = blocks;
    options.locals.scripts = blocks.scripts;
    options.locals.stylesheets = blocks.stylesheets;
    options.locals.block = block.bind(blocks);
    options.locals.stylesheet = stylesheet.bind(blocks.stylesheets);
    options.locals.script = script.bind(blocks.scripts);
  }
  // override locals for layout/partial bound to current options
  options.locals.layout = layout.bind(options);

  try {
    const fn = ejs.compile(file, options);
    cb(null, fn.toString());
  } catch (ex) {
    cb(ex);
  }
}

function renderFile(file, options, fn) {
  // Express used to set options.locals for us, but now we do it ourselves
  // (EJS does some __proto__ magic to expose these funcs/values in the template)
  if (!options.locals) {
    options.locals = {};
  }

  options.__proto__ = options.locals;

  if (!options.locals.blocks) {
    // one set of blocks no matter how often we recurse
    const blocks = { scripts: new Block(), stylesheets: new Block() };
    options.locals.blocks = blocks;
    options.locals.scripts = blocks.scripts;
    options.locals.stylesheets = blocks.stylesheets;
    options.locals.block = block.bind(blocks);
    options.locals.stylesheet = stylesheet.bind(blocks.stylesheets);
    options.locals.script = script.bind(blocks.scripts);
  }
  // override locals for layout/partial bound to current options
  options.locals.layout = layout.bind(options);

  ejs.renderFile(file, options, function(err, html) {
    if (err) {
      return fn(err, html);
    }

    let layout = options.locals._layoutFile;

    // for backward-compatibility, allow options to
    // set a default layout file for the view or the app
    // (NB:- not called `layout` any more so it doesn't
    // conflict with the layout() function)
    if (layout === undefined) {
      layout = options._layoutFile;
    }

    if (layout) {
      // use default extension
      const engine = options.settings['view engine'] || 'ejs',
          desiredExt = '.' + engine;

      // apply default layout if only "true" was set
      if (layout === true) {
        layout = path.sep + 'layout' + desiredExt;
      }
      if (extname(layout) !== desiredExt) {
        layout += desiredExt;
      }

      // clear to make sure we don't recurse forever (layouts can be nested)
      delete options.locals._layoutFile;
      delete options._layoutFile;
      // make sure caching works inside ejs.renderFile/render
      delete options.filename;

      if (layout.length > 0) {
        let views = options.settings.views;
        const l = layout;

        if (!Array.isArray(views)) {
          views = [views];
        }

        for (let i = 0; i < views.length; i++) {
          layout = join(views[i], l);

          // use the first found layout
          if (exists(layout)) {
            break;
          }
        }
      }

      // now recurse and use the current result as `body` in the layout:
      options.locals.body = html;
      renderFile(layout, options, fn);
    } else {
      // no layout, just do the default:
      fn(null, html);
    }
  });
}

/**
 * Apply the given `view` as the layout for the current template,
 * using the current options/locals. The current template will be
 * supplied to the given `view` as `body`, along with any `blocks`
 * added by child templates.
 *
 * `options` are bound  to `this` in renderFile, you just call
 * `layout('myview')`
 *
 * @param  {String} view
 * @api private
 */
function layout(view) {
  this.locals._layoutFile = view;
}

function Block() {
  this.html = [];
}

Block.prototype = {
  toString: function() {
    return this.html.join('\n');
  },
  append: function(more) {
    this.html.push(more);
  },
  prepend: function(more) {
    this.html.unshift(more);
  },
  replace: function(instead) {
    this.html = [ instead ];
  }
};

/**
 * Return the block with the given name, create it if necessary.
 * Optionally append the given html to the block.
 *
 * The returned Block can append, prepend or replace the block,
 * as well as render it when included in a parent template.
 *
 * @param  {String} name
 * @param  {String} html
 * @return {Block}
 * @api private
 */
function block(name, html) {
  // bound to the blocks object in renderFile
  let blk = this[name];
  if (!blk) {
    // always create, so if we request a
    // non-existent block we'll get a new one
    blk = this[name] = new Block();
  }
  if (html) {
    blk.append(html);
  }
  return blk;
}

// bound to scripts Block in renderFile
function script(path, type) {
  if (path) {
    this.append('<script src="' + path + '"' + (type ? 'type="' + type + '"' : '') + '></script>');
  }
  return this;
}

// bound to stylesheets Block in renderFile
function stylesheet(path, media) {
  if (path) {
    this.append('<link rel="stylesheet" href="' + path + '"' + (media ? 'media="' + media + '"' : '') + ' />');
  }
  return this;
}

renderFile.compile = compile;
renderFile.block = block;
renderFile.layout = layout;

module.exports = renderFile;
