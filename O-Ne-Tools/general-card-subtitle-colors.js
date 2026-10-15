/* General-card subtitle ranges use UTF-16 offsets, matching native input selections. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ONEGeneralSubtitleColors = api;
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';
  var DEFAULT = '#FDF3E7';
  var COLORS = ['#FDF3E7', '#FFFFFF', '#FFBE37', '#29A6A7', '#3F8FB7', '#FD4537', '#433A35', '#1F1713'];

  function pack(colors) {
    var ranges = [];
    colors.forEach(function (color, i) {
      if (!color || color === DEFAULT) return;
      var last = ranges[ranges.length - 1];
      if (last && last.end === i && last.color === color) last.end++;
      else ranges.push({ start: i, end: i + 1, color: color });
    });
    return ranges;
  }
  function expand(text, ranges) {
    var colors = Array(text.length).fill(null);
    if (ranges == null) return colors;
    if (!Array.isArray(ranges) || ranges.length > text.length) throw new Error('副標色彩範圍格式錯誤。');
    ranges.forEach(function (range) {
      if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end) ||
          range.start < 0 || range.end <= range.start || range.end > text.length ||
          typeof range.color !== 'string' || COLORS.indexOf(range.color.toUpperCase()) < 0) {
        throw new Error('副標色彩範圍或色票無效。');
      }
      // Never split an emoji's UTF-16 surrogate pair.
      [range.start, range.end].forEach(function (offset) {
        if (offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset] || '')) {
          throw new Error('副標色彩範圍不可切開表情符號。');
        }
      });
      colors.fill(range.color.toUpperCase(), range.start, range.end);
    });
    return colors;
  }
  function normalize(text, ranges) { return pack(expand(text, ranges)); }
  function apply(text, ranges, start, end, color) {
    var colors = expand(text, ranges);
    // Reuse import validation for the new selection as well.
    expand(text, [{ start: start, end: end, color: color }]);
    colors.fill(color.toUpperCase(), start, end);
    return pack(colors);
  }
  function remap(before, after, ranges) {
    var colors = expand(before, ranges), start = 0, tail = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    while (tail < before.length - start && tail < after.length - start &&
           before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
    var removed = colors.slice(start, before.length - tail), inherit = null;
    if (removed.length && removed.every(function (c) { return c === removed[0]; })) inherit = removed[0];
    else if (!removed.length && start > 0 && start < before.length && colors[start - 1] === colors[start]) inherit = colors[start];
    return pack(colors.slice(0, start).concat(Array(after.length - start - tail).fill(inherit), tail ? colors.slice(before.length - tail) : []));
  }
  function draw(ctx, text, ranges, x, y) {
    ctx.fillStyle = DEFAULT;
    ctx.fillText(text, x, y);
    normalize(text, ranges).forEach(function (range) {
      var left = ctx.measureText(text.slice(0, range.start)).width;
      var right = ctx.measureText(text.slice(0, range.end)).width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + left, 0, right - left, ctx.canvas.height);
      ctx.clip();
      ctx.fillStyle = range.color;
      // Draw the full shaped line through a clip to retain native kerning and layout.
      ctx.fillText(text, x, y);
      ctx.restore();
    });
  }
  return { normalize: normalize, apply: apply, remap: remap, draw: draw };
});
