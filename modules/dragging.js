import storage from './storage.js';

// Stages of dragging something
let predrag;
let dragging = false;
let postdrag;

let dragTarg = null; // the thing being dragged
let xOffset; // offset between the client coords and the top left corner of the target so it drags from the starting point

// mousedown coords
let startX;
let startY;

let yOffset;
let timeYOffset = 0; // extra Y offset for when dragging the time

let framePending = false; // for requestAnimationFrame for dragging

let _allLinks;
let _otherCoords;
let _options;

const containers = document.getElementsByClassName('linkContainer');

// positions of all the stuff that's been dragged
let positions = [];

/**
 * Set up for dragging an element
 * @param {HTMLElement} e
 */
function setDrag(e) {
  if (dragTarg == null) {
    return;
  }
  const bound = dragTarg.getBoundingClientRect(dragTarg);
  startX = e.x;
  startY = e.y;
  xOffset = bound.x - e.x;
  yOffset = bound.y - e.y;
  predrag = true;
  positions.length = 0;
  for (const i of containers) {
    if (i.offsetLeft !== undefined && i !== dragTarg) { // don't add the dragged element, or there would be a ghost of it that it would hit
      positions.push({
        left: i.offsetLeft,
        right: i.offsetLeft + i.offsetWidth,
        top: i.offsetTop,
        bottom: i.offsetTop + i.offsetHeight,
      });
    }
  }
  document.addEventListener('mousemove', doDragging, { useCapture: false });
}

function stopDrag() {
  dragging = false;
  dragTarg = null;
}

/**
 * @param {HTMLElement} e
 */
function doDragging(e) { // for mousemove event listener, removed when mouse is up
  e.preventDefault(); // prevent highlighting and normal link dragging
  if (predrag) { // all the stuff that should only happen once
    predrag = false;

    if (dragTarg.matches('.linkContainer')) {
      dragTarg.querySelector('.edit').style.display = 'none'; // hide edit button while dragging a link
    }
    else if (dragTarg.matches('#time')) {
      timeYOffset = -21.5; // y offset for time (so it snaps correctly)
    }

    // append the target directly to the body if it's in the starting div
    if (dragTarg.parentNode.tagName !== 'BODY') {
      document.body.appendChild(dragTarg);
    }
    dragTarg.style.position = 'absolute';
  }

  if (!dragTarg || framePending || (Math.hypot(startX - e.clientX, startY - e.clientY) < 10 && !dragging)) {
    return;
  }
  framePending = true;
  requestAnimationFrame(() => {
    dragging = true;
    framePending = false;
    let yboundary = false; // for telling if it's hitting the sides I think
    let xboundary = false;
    let xCoord = e.x + xOffset;
    const yCoord = e.y + yOffset;

    ({ xboundary, yboundary } = isOnEdgeOfWindow(xCoord, yCoord, dragTarg));

    if (!_options.optoverlap && dragTarg.matches('.linkContainer')) { // check for overlap on other links
      let isOverLink = false;

      // check for overlap once for each link, but return early if there's a point where it's not overlapping
      for (const _ in positions) {
        ({ x: xCoord, isOverLink } = isOverlappingLinks(xCoord, dragTarg));
        if (!isOverLink) {
          break;
        }
      }

      // keep xboundary true if it's true from isOnEdgeOfWindow
      xboundary = isOverLink || xboundary;
    }

    // if nothing is colliding
    !xboundary && (dragTarg.style.left = xCoord + 'px');

    if (!yboundary) {
      if (
        ((_options.optTimeGrid && dragTarg.matches('#time')) || // or dragging time and snap time
          (_options.optLinksGrid && !dragTarg.matches('#time'))) // or not dragging time and snap links
        && multiMatch(dragTarg, '.linkContainer', '#time')) { // never snap weather or system links
        dragTarg.style.top = (Math.trunc((e.y - 8) / 45) * 45 + timeYOffset + 8) + 'px';
      }
      else {
        dragTarg.style.top = e.y + yOffset + 'px';
      }
    }
  });
}

/**
 * Match multiple potential selectors to an event target
 * @param {HTMLElement} element The element to match against
 * @param  {...string} selectors An array of CSS selectors to test against the element
 * @returns {boolean} True if any of the selectors match the element, and false otherwise
 */
function multiMatch(element, ...selectors) {
  for (const i of selectors) {
    if (element.matches(i)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an element is on the edge of the window, and if so, limit it to inside the window
 * @param {number} x The x-coordinate
 * @param {number} y the y-coordinate
 * @param {Element} target The element to check if it's on the edge of the window
 * @returns {Object} overlapping in x and overlapping in y
 */
function isOnEdgeOfWindow(x, y, target) {
  let xboundary = false;
  let yboundary = false;
  if (x < 1) { // left
    target.style.left = _options.optLinksGrid ? '8px' : '0';
    xboundary = true;
  }
  else if (x + target.offsetWidth > window.innerWidth) { // right
    target.style.left = window.innerWidth - target.offsetWidth + 'px';
    xboundary = true;
  }
  if (y < 1) { // top
    target.style.top = '0';
    yboundary = true;
  }
  else if (y + target.offsetHeight > window.innerHeight) { // bottom
    target.style.top = window.innerHeight - target.offsetHeight + 'px';
    yboundary = true;
  }
  return { xboundary, yboundary }
}

/**
 * Check if the target link is overlapping any other links, and if so, move it over so it is not.
 * @param {number} x The x-coordinate
 * @param {Element} target The link to check if it's overlapping other links
 * @returns {Object} new x-coordinate and whether or not it was overlapping a link
 */
function isOverlappingLinks(x, target) {
  let isOverLink = false;
  for (const i of positions) {
    // lined up on the y-axis
    if (
      (target.offsetTop >= i.top && target.offsetTop <= i.bottom) ||
      (target.offsetTop + target.offsetHeight >= i.top && target.offsetTop + target.offsetHeight <= i.bottom) ||
      (target.offsetTop <= i.top && target.offsetTop + target.offsetHeight >= i.bottom)) {

      // target to the right of another link
      if (
        x < i.right + 9 &&
        x > i.left - 9) {
        target.style.left = i.right + 4 + 'px';
        // update x so it can check if the new position is over any links
        x = target.offsetLeft;
        isOverLink = true;
      }
      // target to the left of another link, or target encloses (default to left)
      else if (
        (x + target.offsetWidth < i.right + 9 &&
          x + target.offsetWidth > i.left - 9) ||
        (x < i.left + 9 &&
          x + target.offsetWidth > i.right - 9)) {
        target.style.left = i.left - target.offsetWidth - 9 + 'px';
        // update x position so it can check if the new position is over any links
        x = target.offsetLeft;
        isOverLink = true;
      }
    }
  }
  return { x, isOverLink };
}

/**
 * Initialize dragging
 * @param {*} allLinks All the draggable links
 * @param {*} otherCoords Coordinates for other items
 * @param {*} options 
 */
function initialize(allLinks, otherCoords, options) {
  _allLinks = allLinks;
  _otherCoords = otherCoords;
  _options = options;

  document.addEventListener('click', e => {
    if (postdrag) {
      e.preventDefault();
      postdrag = false;
    }
  }, false);

  document.addEventListener('mousedown', e => {
    if (e.button !== 1 && e.button !== 2) { // don't drag on middle click or right click
      if (e.target.closest('.linkContainer') && !e.target.matches('.edit')) {
        dragTarg = e.target.closest('.linkContainer');
      }
      else if (e.target.closest('.draggable') && !e.target.closest('.nodrag')) {
        dragTarg = e.target.closest('.draggable');
      }

      if (dragTarg) {
        e.preventDefault();
      }
      setDrag(e);
    }
  }, false);

  document.addEventListener('mouseup', e => {
    document.removeEventListener('mousemove', doDragging, { passive: true, useCapture: false });

    timeYOffset = 0;
    if (!dragging && !predrag && dragTarg && dragTarg.matches('.linkContainer')) {
      // if started dragging but didn't exceed the starting drag distance, and trying to drag a link, click
      // this is to stop you from accidentally dragging a link a tiny bit when you just wanted to click on it.
      click();
    }
    else if (dragging && dragTarg != null) {
      e.preventDefault();
      postdrag = true;

      if (dragTarg.matches('.linkContainer')) {
        dragTarg.querySelector('.edit').style.display = ''; // unhide edit button when dropped
        const fixlink = dragTarg.querySelector('a').href;
        _allLinks.find(i => {
          if (fixlink === i.url) {
            i.x = dragTarg.offsetLeft - 3; // I don't know why this correction is necessary - body offset?
            i.y = dragTarg.offsetTop - 3;
            return true;
          }
        });
      }
      else if (dragTarg.matches('#time')) {
        _otherCoords.time = { x: dragTarg.offsetLeft, y: dragTarg.offsetTop };
      }
      else if (dragTarg.matches('#weather')) {
        _otherCoords.weather = { x: dragTarg.offsetLeft, y: dragTarg.offsetTop };
      }
      else if (dragTarg.matches('#system')) {
        _otherCoords.systemLinks = { x: dragTarg.offsetLeft, y: dragTarg.offsetTop };
      }
      else if (dragTarg.matches('#notes')) {
        _otherCoords.notes = { x: dragTarg.offsetLeft, y: dragTarg.offsetTop };
      }
      else if (dragTarg.matches('#todoist')) {
        _otherCoords.todo = { x: dragTarg.offsetLeft, y: dragTarg.offsetTop };
      }

      storage.set({ links: _allLinks });
      storage.set({ otherCoords: _otherCoords });
    }
  }, false);
}

export { initialize, dragging, stopDrag };
