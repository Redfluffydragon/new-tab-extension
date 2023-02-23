import storage from './modules/storage.js';
import { gotchem } from './modules/storage.js';
import { initialize as dragInit, dragging, stopDrag } from './modules/dragging.js';
import config from './config.js';
import Fluid from './modules/fluid.js';
import { isNight, getUpdateWeather, skycon, stopWeather, initialize as weatherInit, changeWeatherMode } from './modules/weather.js';
import { simpleTime } from './modules/utils.js';

Fluid.initialize();

const browser = window.browser || chrome;

const background = document.getElementById('background');
const fluidBg = document.getElementById('fluidBg');
const bgCredit = document.getElementById('bgCredit');
const urlInput = document.getElementById('urlInput');
const titleInput = document.getElementById('titleInput');
const links = document.getElementById('links');
const plusmoda = document.getElementById('plusmoda');
const shadow = document.getElementById('shadow');
const time = document.getElementById('time');
const notes = document.getElementById('notes');
const todoist = document.getElementById('todoist');
const notesBody = document.getElementById('notesBody');
const todo = document.getElementById('todoist');

const editmoda = document.getElementById('editmoda');
const changename = document.getElementById('changename');
const changeurl = document.getElementById('changeurl');

const optmoda = document.getElementById('optmoda');
const importModa = document.getElementById('importModa');
const importInput = document.getElementById('importInput');

// all the options checkboxes
const optionsElements = {
  optTimeGrid: document.getElementById('optTimeGrid'),
  optLinksGrid: document.getElementById('optLinksGrid'),
  optoverlap: document.getElementById('optoverlap'),
  showSeconds: document.getElementById('showSeconds'),
  showWeather: document.getElementById('showWeather'),
  showNotes: document.getElementById('showNotes'),
  showSysLinks: document.getElementById('showSysLinks'),
  darkMode: document.getElementById('darkMode'),
  weatherMatchMode: document.getElementById('weatherMatchMode'),
  timeMatchMode: document.getElementById('timeMatchMode'),
  showTodo: document.getElementById('showTodoist'),
};
const customBgUrl = document.getElementById('customBgUrl');

const system = document.getElementById('system');

const weather = document.getElementById('weather');

let optopen = false; // if the options modal is open or not
let getLink;
let linkInArray; // pass the location of the link in the links array between functions


// list of background image sources and whether they count as dark for dark mode
const images = [
  { src: 'img/red-flower.jpg', dark: true, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/bridge-with-flowers.jpg', dark: false, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/carst.jpg', dark: true, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/guilin-building.jpg', dark: true, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/park-pano.jpg', dark: true, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/pink-flower.jpg', dark: false, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/pink-flowers.jpg', dark: false, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/digital-pink-flower.png', dark: false, copyright: '© 2019 Kai-Shen Deru' },
  { src: 'img/mountains-and-river.jpg', dark: true, copyright: '© 2019 Kai-Shen Deru' },
];

const allLinks = config?.preload;

const otherCoords = { // store coordinates for other items that can be dragged
  time: {},
  weather: {},
  systemLinks: {},
  notes: {},
  todo: {},
};
const options = {
  optTimeGrid: true,
  optLinksGrid: true,
  optoverlap: false,
  showSeconds: false,
  showWeather: true,
  showSysLinks: true,
  darkMode: false,
  weatherMatchMode: false,
  timeMatchMode: false,
  showNotes: false,
  showTodo: false,
  bgType: 'images',
  customBgUrl: '',
};

// initialize dragging and give it all required info
dragInit(allLinks, otherCoords, options);
weatherInit(() => {
  if (options.weatherMatchMode || options.timeMatchMode) {
    autoDarkMode(); // now, set dark mode automatically
  }
  weather.style.height = weather.offsetHeight + 'px'; // fix height so it can be dragged around
  weather.style.width = weather.offsetWidth + 'px';
  if (otherCoords.weather !== {}) {
    weather.style.left = otherCoords.weather.x + 'px'; // only then set position - otherwise it gets all stretched
    weather.style.top = otherCoords.weather.y + 'px';
  }
}, options);

let noteText = '';
let noteSize = {};

const setFromStorage = { // to set variables when chrome storage syncs
  links: links => {
    allLinks.length = 0;
    for (const link of links) {
      allLinks.push(link);
    }
  },
  otherCoords: newCoords => {
    for (const coord in newCoords) {
      otherCoords[coord] = newCoords[coord];
    }
    setPosition(time, 'time');
    setPosition(system, 'systemLinks');
    setPosition(notes, 'notes');
    setPosition(todo, 'todo');
  },
  options: newOptions => {
    for (const opt in newOptions) {
      options[opt] = newOptions[opt];
    }
  },
  notes: newText => {
    noteText = newText;
    notesBody.value = newText;
  },
  noteSize: newObj => {
    noteSize = newObj;
    notesBody.style.height = newObj.height + 'px';
    notesBody.style.width = newObj.width + 'px';
  }
};

gotchem('links', r => {
  if (r != null) {
    setFromStorage.links(r);
  }
  allLinks.sort((a, b) => a.x - b.x).sort((a, b) => a.y - b.y);
  for (const link of allLinks) { // draw all links
    newLink({ ...link, makeNew: false });
  }
});

gotchem('otherCoords', r => {
  if (r != null) {
    setFromStorage.otherCoords(r);
  }
});

gotchem('options', r => {
  if (r != null) {
    setFromStorage.options(r);
  }
  newBackground();
  showTime();

  options.showNotes && notes.classList.remove('none');

  options.showTodo && todoist.classList.remove('none');

  !options.showSysLinks && system.classList.add('none');

  options.darkMode && document.documentElement.toggleAttribute('dark', true);

  options.showWeather ? getUpdateWeather() : weather.classList.add('none');

  if (options.bgType === 'fluid') {
    fluidBg.classList.remove('none');
    Fluid.start();
  }
  else if (options.bgType === 'custom') {
    background.src = options.customBgUrl;
  }
});

gotchem('notes', r => {
  if (r != null) {
    setFromStorage.notes(r);
  }
});

gotchem('noteSize', r => {
  if (r != null) {
    setFromStorage.noteSize(r);
  }
});

/**Get and show the current time*/
function showTime() {
  requestAnimationFrame(showTime);
  time.textContent = simpleTime(new Date(), options.showSeconds);
}

/** Set a new background */
function newBackground() {
  if (options.bgType !== 'images') {
    return;
  }

  let newBg;
  do {
    newBg = images[Math.trunc(Math.random() * images.length)];
  }
  while (options.darkMode && !newBg.dark);

  background.src = 'img/' + newBg.src;
  bgCredit.innerText = newBg.credit;

  return true;
}

/**Toggle dark/light mode*/
function changeMode() {
  if (options.darkMode) {
    images.find(bg => background.src.includes(bg.src) && !bg.dark && newBackground());
  }
  document.documentElement.toggleAttribute('dark', options.darkMode);
  changeWeatherMode();
}

/**If dark mode is possible from either match weather or match time, switch and show dark mode*/
function autoDarkMode() {
  const now = new Date().getTime() / 1000;
  options.darkMode =
    (options.weatherMatchMode && (/overcast|rain|snow|sleet|fog|(cloudy(?!-|_))/i).test(skycon.list[0].name)) ||
    (options.timeMatchMode && isNight);
  storage.set({ options });
  optionsElements.darkMode.checked = options.darkMode; // update right here so you can see it as you're changing options
  changeMode();
}

/**
 * Set the position of an element in otherCoords
 * @param {HTMLElement} element
 * @param {String} coords
 */
function setPosition(element, coords) { // for setting position of everything but links
  if (otherCoords[coords] !== {}) {
    element.style.position = 'absolute';
    element.style.left = otherCoords[coords].x + 'px';
    element.style.top = otherCoords[coords].y + 'px';
  }
}

/**
 * Remove extra stuff from the end of links to try and get the favicon successfully
 * @param {String} url
 */
function baseLink(url) { //remove specific page stuff from the URL to try to get the favicon
  const hasTLD = url.search(/\.\b(?:edu|com|org|net|gov)\b/);
  if (!url.includes('google.com') && !url.includes('github.io') && hasTLD !== -1) { //specific fixes
    url = url.slice(0, hasTLD + 4); //slice at found point + get .com or whatever
  }
  return url;
}

/**
 * Get the favicon from a website (mostly uses google's favicon getting service, except that that doesn't work for google services.)
 * @param {HTMLElement} icon Image element to set the source of
 * @param {string} link Website to scrape favicon from
 */
function newIcon(icon, link) {
  if (link.includes('introvertdear')) { // their favicon.ico file is not the one that actually appears on their website
    icon.src = 'https:/introvertdear.com/wp-content/uploads/2017/10/cropped-I-D-yellow-logo-NEW-32x32.jpg';
    return;
  }
  else if (link.includes('mail.google')) {
    icon.src = 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico';
  }
  else if (link.includes('calendar.google')) {
    icon.src = 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_3.ico';
  }
  else if (link.includes('keep.google')) {
    icon.src = 'https://ssl.gstatic.com/keep/icon_2020q4v2_128.png';
  }
  else if (link.includes('drive.google')) {
    icon.src = '//ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png';
  }
  else if (link.includes('news.google')) {
    icon.src = 'https://lh3.googleusercontent.com/-DR60l-K8vnyi99NZovm9HlXyZwQ85GMDxiwJWzoasZYCUrPuUM_P_4Rb7ei03j-0nRs0c4F=w32';
  }
  else if (link.includes('google')) {
    let gService;
    if (link.includes('photos') || link.includes('translate')) { // for non-docs services
      gService = link.slice(8, link.indexOf('.'));
    }
    else if (link.includes('maps')) {
      gService = 'maps';
    }
    else if (link.includes('docs.google')) { // for docs services
      if (link.includes('presentation')) {
        gService = 'slides';
      }
      else if (link.includes('spreadsheets')) {
        gService = 'sheets';
      }
      else if (link.includes('document')) {
        gService = 'docs';
      }
    }
    else {
      icon.src = 'https://www.google.com/favicon.ico'; // for just regular google
      return;
    }
    icon.src = `https://www.gstatic.com/images/branding/product/1x/${gService}_48dp.png`;
  }
  else if (link.includes('oreprint.mines.edu')) {
    icon.src = 'https://oreprint.mines.edu/images/icons3/favicon.ico';
  }
  else if (link.includes('canvas.mines.edu') || link.includes('trailhead.mines.edu')) {
    icon.src = 'https://www.mines.edu/wp-content/uploads/assets/icon_triangle_4c_r-512x512.png';
  }
  else if (link.includes('wired.com')) {
    icon.src = 'https://www.wired.com/verso/static/wired-homepage/assets/favicon.ico';
  }
  else {
    icon.src = baseLink(link) + '/favicon.ico';
  }
  return icon.src;
}

/**
 * Generate a new link and add it to the DOM
 * @param {Object} link An object containing all the link properties
 * @param {string} link.url The link url
 * @param {string} link.name The link name to display
 * @param {number} link.x (Optional) the x-coordinate of the link
 * @param {number} link.y (Optional) the y-coordinate of the link
 * @param {boolean} link.makeNew (Default: false) Whether or not to add the new link to the allLinks array
 */
function newLink(link) {
  const {
    url,
    name,
    x = null,
    y = null,
    makeNew = false,
  } = link

  const template = document.getElementById('linkTemplate').content.cloneNode(true);

  let tempUrl = url;
  !url.includes('http') && !url.includes('file:') && (tempUrl = 'https://' + url);

  template.querySelector('a').href = tempUrl;

  const icon = template.querySelector('img');

  // Set error handler
  // last resort, use google's favicon finder
  icon.onerror = () => {
    icon.onerror = null;
    icon.src = `https://s2.googleusercontent.com/s2/favicons?domain_url=${tempUrl}`;
  }

  // Then try to get the favicon
  newIcon(icon, tempUrl);

  template.querySelector('.linkTitle').textContent = name;

  if (x != null && y != null) { // if it has a position, put it in the body at the right coordinates
    const container = template.querySelector('.linkContainer');
    container.style.position = 'absolute';
    container.style.left = x + 'px';
    container.style.top = y + 'px';

    document.body.appendChild(template);
  }
  else { // else, put it in the container and move the plus btn to the end
    links.appendChild(template);
  }

  if (makeNew) {
    allLinks.push({ url: tempUrl, name: name, iconSrc: icon.src });
    urlInput.value = '';
    titleInput.value = '';
    closeAll();
  }
}

/**Close all modals*/
function closeAll() {
  plusmoda.toggleAttribute('show', false);
  editmoda.toggleAttribute('show', false);
  optmoda.toggleAttribute('show', false);
  importModa.toggleAttribute('show', false);
  shadow.toggleAttribute('show', false);

  importInput.value = '';
  document.querySelector('[name=importOpt]').checked = true;

  if (optopen) { // set options correctly
    for (const key in optionsElements) {
      options[key] = optionsElements[key].checked;
    }
    optopen = false;
  }
  storage.set({ links: allLinks });
}

/**Save edits on a link*/
function save() {
  newIcon(getLink.children[0], changeurl.value);
  getLink.children[1].textContent = changename.value;
  getLink.href = changeurl.value;
  linkInArray.name = changename.value;
  linkInArray.url = getLink.href; // 'cause it adds a slash sometimes
  closeAll();
}

/**Add a new link*/
function addLink() {
  urlInput.value !== '' && titleInput.value !== '' ?
    newLink({ url: urlInput.value, name: titleInput.value, makeNew: true }) :
    alert(`You haven't filled out all the fields.`);
}

/**
 * Insert a string at the specified index into another string
 * @param {string} string The string to insert into
 * @param {number} index The index to insert at
 * @param {string} insertValue The string to insert
 * @returns {string}
 */
const insertString = (string, index, insertValue) => string.slice(0, index) + insertValue + string.slice(index);

browser.storage.onChanged.addListener(changes => {
  for (const key of Object.keys(changes)) {
    setFromStorage[key]?.(changes[key].newValue);
  }
});

document.addEventListener('click', e => { // reset, edit, save, and delete
  // EDIT LINKS
  if (e.target.matches('.edit')) { // open the edit modal
    getLink = e.target.parentNode.querySelector('a');
    editmoda.toggleAttribute('show', true);
    shadow.toggleAttribute('show', true);
    changename.value = getLink.textContent.trim();
    changeurl.value = getLink.href;
    changename.focus();
    allLinks.find(link => { // find the current link in the allLinks array
      if (link.url === getLink.href) {
        linkInArray = link;
        return true;
      }
    });
  }
  else if (e.target.matches('#svbtn')) { // save edits
    save();
  }
  else if (e.target.matches('#dltbtn')) { // delete one
    getLink.parentNode.remove();
    allLinks.splice(allLinks.indexOf(linkInArray), 1);
    closeAll();
  }
  else if (e.target.matches('#resetbtn')) { // reset one
    linkInArray.x = null;
    linkInArray.y = null;
    const moveLink = getLink.parentNode;
    moveLink.style.position = 'relative';
    moveLink.style.left = '';
    moveLink.style.top = '';
    links.appendChild(moveLink);
    closeAll();
  }

  // BOTTOM BUTTONS (BESIDES OPTIONS)
  else if (e.target.matches('#downloadsFolder')) {
    chrome.downloads.showDefaultFolder();
  }
  else if (e.target.matches('#newback')) { // change the background
    newBackground();
  }
  else if (e.target.matches('#plusbtn')) { // open new link modal
    plusmoda.toggleAttribute('show', true);
    shadow.toggleAttribute('show', true);
    urlInput.focus();
  }
  else if (e.target.matches('#addbtn')) { // add a new link
    addLink();
  }

  // OPTIONS
  else if (e.target.matches('#options')) { // open options modal
    optmoda.toggleAttribute('show', true);
    shadow.toggleAttribute('show', true);

    // make inputs match current options
    for (const key in optionsElements) {
      optionsElements[key].checked = options[key];
    }

    document.querySelector(`[value=${options.bgType}]`).checked = true;

    customBgUrl.value = options.customBgUrl || '';
    if (options.bgType === 'custom') {
      customBgUrl.disabled = false;
    }

    optopen = true;
  }
  else if (e.target.matches('#showSeconds')) { // show or hide seconds
    // checks it every second ish, so nothing further is needed
    options.showSeconds = e.target.checked;
  }
  else if (e.target.matches('#showWeather')) { // change show weather settings
    weather.classList.toggle('none');
    if (optionsElements.showWeather.checked) { // if now showing weather, get it and set update interval
      getUpdateWeather();
    }
    else { // stop updating weather
      stopWeather();
    }
    options.showWeather = e.target.checked;
  }
  else if (e.target.matches('#showNotes')) { // show/hide notes
    options.showNotes = e.target.checked;

    notes.classList.toggle('none');
    if (notesBody.offsetHeight - 6 !== noteSize.height) {
      notesBody.style.height = noteSize.height + 'px';
      notesBody.style.width = noteSize.width + 'px';
    }
  }
  else if (e.target.matches('#showTodoist')) { // show/hide todoist panel
    todoist.classList.toggle('none');
    options.showTodo = e.target.checked;
  }
  else if (e.target.matches('#showSysLinks')) { // show/hide system links
    system.classList.toggle('none');
    options.showSysLinks = e.target.checked;
  }
  else if (e.target.matches('#darkMode')) { // switch light/dark mode
    // needs to change options right here because it calls changeMode immediately and that reads from options
    options.darkMode = e.target.checked;
    optionsElements.weatherMatchMode.checked = false; // unset matching if set dark mode manually
    optionsElements.timeMatchMode.checked = false;
    options.weatherMatchMode = false;
    options.timeMatchMode = false;
    changeMode();
  }
  else if (e.target.matches('#weatherMatchMode')) { // match dark mode to weather
    options.weatherMatchMode = e.target.checked; // toggle weatherMatchMode
    autoDarkMode(); // change dark mode accordingly
  }
  else if (e.target.matches('#timeMatchMode')) { // match dark mode to time
    options.timeMatchMode = e.target.checked;
    autoDarkMode();
  }
  else if (e.target.matches('[name=bgSelect]')) { // select background type
    options.bgType = e.target.value;
    if (options.bgType === 'fluid') {
      fluidBg.classList.remove('none');
      Fluid.start();
    }
    else {
      fluidBg.classList.add('none');
      Fluid.stop();
    }
    if (options.bgType === 'images') {
      if (!background.src || background.src === options.customBgUrl) {
        newBackground();
      }
    }
    if (options.bgType === 'custom') {
      customBgUrl.disabled = false;
      background.src = customBgUrl.value;
    }
    else {
      customBgUrl.disabled = true;
    }
  }
  else if (e.target.matches('#exportBtn')) { // export links to clipboard
    navigator.clipboard.writeText(JSON.stringify(allLinks));
  }
  else if (e.target.matches('#importBtn')) { // open import modal
    closeAll(); // close options modal first because the css is easier this way
    importModa.toggleAttribute('show', true);
    shadow.toggleAttribute('show', true);
  }
  else if (e.target.matches('#actuallyImport')) { // actually import links
    let newLinks;
    try {
      newLinks = JSON.parse(importInput.value);
    }
    catch {
      alert('Invalid import');
      return;
    }
    const method = document.querySelector('[name=importOpt]:checked').value;
    if (method === 'append') {
      allLinks.push(...newLinks);
    }
    else if (method === 'replace') {
      setFromStorage.links(newLinks);
    }
    storage.set({ links: allLinks });
    closeAll();
    location.reload();
  }

  // SYSTEM LINKS
  else if (e.target.closest('#system') && !e.target.matches('#system') && !dragging) { // prevent system links from linking
    e.preventDefault(); // do stuff on mouseup
  }

  // OTHER
  else if (e.target.matches('.cnclbtn')) { // cancel and close modals
    closeAll();
  }
  else if (e.target.matches('.resetWeather') && !dragging) { // reset the weather div to its default position
    weather.style.left = '';
    weather.style.top = '';
    otherCoords.weather = {};
    storage.set({ otherCoords });
  }
  stopDrag();
}, false);

document.addEventListener('mousedown', e => { // for dragging, and closing modals
  !e.target.closest('.moda') && closeAll();
}, false);

document.addEventListener('mouseup', e => {
  if (!dragging && e.target.closest('#system') && !e.target.matches('#system') && e.button !== 2) { // open system links
    e.preventDefault();
    if (e.button === 1 || e.ctrlKey) { // button three or holding control opens in new tab
      chrome.tabs.create({ url: 'chrome://' + e.target.id, active: false });
    }
    else { // otherwise, change current tab
      chrome.tabs.update(null, { url: 'chrome://' + e.target.id });
    }
  }
  else if (e.target.matches('#notesBody')) {
    noteSize = { width: notesBody.offsetWidth - 6, height: notesBody.offsetHeight - 6 }
    storage.set({ noteSize });
  }
}, false);

document.addEventListener('keydown', e => { // escape for modals and enter to do default action
  if (e.key === 'Escape') { // Escape
    closeAll();
    if (document.activeElement.matches('#notesBody')) {
      // because tab does stuff when editing notes, make sure you can escape
      document.activeElement.blur();
    }
  }
  else if (e.key === 'Enter') { // enter
    if (editmoda.matches('[show]')) {
      save();
    }
    else if (plusmoda.matches('[show]')) {
      addLink();
    }
  }
  if (document.activeElement.matches('#notesBody')) { // all notes key stuff
    const startPos = notesBody.selectionStart;
    const lines = notesBody.value.split('\n');
    const currentLineNum = notesBody.value.slice(0, startPos).split('\n').length - 1;
    const oldLine = lines[currentLineNum];

    switch (e.key) {
      case 'Enter':
        // bullet list - hyphen and asterisk are supported
        if (/^ +[-|\*] \S/.test(oldLine)) {
          e.preventDefault();
          const listType = oldLine.match(/^ +([-|\*])/)[0];
          const numSpaces = oldLine.indexOf(listType);
          notesBody.value = insertString(notesBody.value, startPos, `\n${' '.repeat(numSpaces)}${listType} `);
          notesBody.selectionEnd = startPos + numSpaces + 4;
        }
        // if you hit enter on a line with just a bullet point, get rid of the bullet point
        else if (/^ +(-|\*) /.test(oldLine) && !/\S/.test(oldLine.slice(oldLine.search(/-|\*/) + 1))) {
          e.preventDefault();
          lines.splice(currentLineNum, 1, '');
          notesBody.value = lines.join('\n');
          notesBody.selectionEnd = startPos - oldLine.length;
        }
        break;
      case 's': // I keep trying to save, so disable that when typing notes
        if (e.ctrlKey) {
          e.preventDefault();
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (/^ {2,}/.test(oldLine) && e.shiftKey) { // tab back out
          lines.splice(currentLineNum, 1, oldLine.slice(2));
          notesBody.value = lines.join('\n');
          notesBody.selectionEnd = startPos - 2;
        }
        // tab in
        else if (/^ +[-|\*]/.test(oldLine) && !/\S/.test(oldLine.slice(oldLine.search(/-|\*/) + 1)) && !e.shiftKey) {
          lines.splice(currentLineNum, 1, '  ' + oldLine);
          notesBody.value = lines.join('\n');
          notesBody.selectionEnd = startPos + 2;
        }
        else if (!e.shiftKey) {
          notesBody.value = insertString(notesBody.value, startPos, '  ');
          notesBody.selectionEnd = startPos + 2;
        }
        break;
      case 'K': // Ctrl+Shift+K removes a line like in VSCode
        if (e.ctrlKey && e.shiftKey) { // Check for shift key so it doesn't trigger if you have caps lock on
          const newSelection = startPos - lines[currentLineNum].length;
          lines.splice(currentLineNum, 1);
          notesBody.value = lines.join('\n');
          notesBody.selectionEnd = newSelection;
        }
        break;
      default:
    }
    notesBody.dispatchEvent(new KeyboardEvent('input'));
  }
}, false);

notesBody.addEventListener('input', () => {
  noteText = notesBody.value;
  storage.set({ notes: noteText });
}, false);

document.forms.optionsForm.addEventListener('input', e => {
  if (options.bgType === 'custom') {
    options.customBgUrl = customBgUrl.value;
    background.src = options.customBgUrl;
  }
  storage.set({ options });
}, false);

document.forms.optionsForm.addEventListener('submit', e => {
  e.preventDefault();
}, false);
