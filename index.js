'use strict';

const background = document.getElementById('background');
const bgCopyright = document.getElementById('bgCopyright');
const plusbtn = document.getElementById('plusbtn');
const addbtn = document.getElementById('addbtn');
const urlInput = document.getElementById('urlInput');
const titleInput = document.getElementById('titleInput');
const links = document.getElementById('links');
const plusmoda = document.getElementById('plusmoda');
const shadow = document.getElementById('shadow');
const time = document.getElementById('time');
const notes = document.getElementById('notes');
const notesBody = document.getElementById('notesBody');

const editbtns = document.getElementsByClassName('edit');
const editmoda = document.getElementById('editmoda');
const changename = document.getElementById('changename');
const changeurl = document.getElementById('changeurl');

const optmoda = document.getElementById('optmoda');
const optTimeGrid = document.getElementById('optTimeGrid');
const optLinksGrid = document.getElementById('optLinksGrid');
const showSeconds = document.getElementById('showSeconds');
const showWeather = document.getElementById('showWeather');
const darkMode = document.getElementById('darkMode');
const weatherMatchMode = document.getElementById('weatherMatchMode');
const timeMatchMode = document.getElementById('timeMatchMode');

const optionsElements = { // for setting all the options checkboxes
  optTimeGrid: optTimeGrid,
  optLinksGrid: optLinksGrid,
  optoverlap: document.getElementById('optoverlap'),
  showSeconds: showSeconds,
  showWeather: showWeather,
  showNotes: document.getElementById('showNotes'),
  showSysLinks: document.getElementById('showSysLinks'),
  darkMode: darkMode,
  weatherMatchMode: weatherMatchMode,
  timeMatchMode: timeMatchMode,
};

const system = document.getElementById('system');

const weather = document.getElementById('weather');

const showIcons = weather.getElementsByClassName('smallSkycon'); // for starting and changing small week skycons
let skycon = null; // for big current skycon
let smallSkycons = []; // for storing small skycons for changing colors

const containers = document.getElementsByClassName('linkContainer');

// positions of all the stuff that's been dragged
let positions = [];

// Stages of draggin something
let predrag;
let dragging = false;
let postdrag;

let dragTarg; // the thing being dragged
let xOffset; // offset between the client coords and the top left corner of the target so it drags from the starting point

// mousedown coords
let startX;
let startY;

let yOffset;
let timeYOffset = 0; // extra Y offset for when dragging the time
let optopen = false; // if the options modal is open or not
let saveMoonPhase = 0; // for passing the moon phase between functions (is there a better way to do this?)
let getLink;
let linkInArray; // pass the location of the link in the links array between functions
let framePending = false; // for requestAnimationFrame for dragging

const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];

// list of background image sources and whether they count as dark for dark mode
const images = [
  { src: 'img/red-flower.jpg', dark: true, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/bridge-with-flowers.jpg', dark: false, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/carst.jpg', dark: true, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/guilin-building.jpg', dark: true, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/park-pano.jpg', dark: true, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/pink-flower.jpg', dark: false, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/pink-flowers.jpg', dark: false, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/digital-pink-flower.png', dark: false, copyright: '2019 Kai-Shen Deru' },
  { src: 'img/mountains-and-river.jpg', dark: true, copyright: '2019 Kai-Shen Deru' },
];

// dawn and dusk
const crepuscs = {};

/**
 * Get and item from Chrome storage and execute a callback function on it
 * @param {String} item
 * @param {Function} fn
 */
function gotchem(item, fn) {
  chrome.storage.sync.get([item], r => {
    fn(r[item]);
  });
}

const allLinks = config.preload;
const otherCoords = { // store coordinates for other items that can be dragged
  time: {},
  weather: {},
  systemLinks: {},
  notes: {},
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
};

let noteText = '';
let noteSize = {};

const setFromStorage = { // to set variables when chrome storage syncs
  links: newArr => {
    allLinks.length = 0;
    for (let i of newArr) {
      allLinks.push(i);
    }
  },
  otherCoords: newObj => {
    for (let i in newObj) {
      otherCoords[i] = newObj[i];
    }
    setPosition(time, 'time');
    setPosition(system, 'systemLinks');
    setPosition(notes, 'notes');
  },
  options: newObj => {
    for (let i in newObj) {
      options[i] = newObj[i];
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
}

gotchem('links', r => {
  if (r != null) {
    setFromStorage.links(r)
  }
  for (let i of allLinks) { // draw all links
    newLink({url: i.url, name: i.name, x: i.x, y: i.y, new: false, iconSrc: i.iconSrc});
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

  !options.showSysLinks && system.classList.add('none');

  options.darkMode && document.documentElement.classList.add('dark');

  options.showWeather ? getUpdateWeather() : weather.classList.add('none');

  document.documentElement.style.setProperty('--weather-highlight-color', (options.darkMode ? '#700067' : '#64ffc8'));
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
})

let weatherInterval; // for setInterval for updating weather
let updateWeatherWhenNextActive; // don't update weather when not active, but update it when next active

/**
 * Get human-readable 12-hour time from unix time
 * @param {number} time
 * @param {boolean} showSecs
 * @returns {string}
 */
function simpleTime(time, showSecs = false) {
  const minutes = ('0' + time.getMinutes()).slice(-2);
  const hours = time.getHours() - (time.getHours() > 12 ? 12 : 0);
  const seconds = showSecs ? `:${('0' + time.getSeconds()).slice(-2)}` : '';
  return `${hours}:${minutes}${seconds}`;
}

/** Get and show the current time */
function showTime() {
  requestAnimationFrame(showTime);
  time.textContent = simpleTime(new Date(), options.showSeconds);
}

/**
 * Turn wind direction degrees into a heading
 * @param {number} degrees
 * @returns {string}
 */
const degrToHeds = degrees => headings[Math.trunc((degrees + 22.5) / 45)];

/**
 * Get the correct Skycon color based on dark mode
 * @returns {String}
 */
const skyconColor = () => options.darkMode ? '#888' : '#333';
skyconColor();

/** Set a new background */
function newBackground() {
  let newBg;
  do {
    newBg = images[Math.trunc(Math.random() * images.length)];
  }
  while (options.darkMode && !newBg.dark);

  background.src = newBg.src;
  bgCopyright.innerText = newBg.copyright;
}

/** Toggle dark/light mode */
function changeMode() {
  if (options.darkMode)  {
    images.find(i =>
      i.src === background.src.slice(background.src.indexOf('img')) && !i.dark && newBackground(options));
  }
  document.documentElement.classList[options.darkMode ? 'add' : 'remove']('dark');
  document.documentElement.style.setProperty('--weather-highlight-color', (!options.darkMode ? '#64ffc8' : '#700067'));
  const getSkyconColor = skyconColor();
  skycon.set('skycons', getSkyconColor);
  for (let i of smallSkycons) {
    i.set(showIcons[i], getSkyconColor);
  }
  showMoonPhase(saveMoonPhase, getSkyconColor);
}

/** If dark mode is possible from either match weather or match time, switch and show dark mode */
function autoDarkMode() {
  const now = new Date().getTime()/1000;
  options.darkMode =
  (options.weatherMatchMode && (/rain|snow|sleet|fog|(cloudy(?!-|_))/i).test(skycon.list[0].name)) ||
  (options.timeMatchMode && (now < crepuscs.dawn || now > crepuscs.dusk));
  chrome.storage.sync.set({options: options}, () => {});
  darkMode.checked = options.darkMode;
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
 * Generate a circle from three points
 * @param {Number} x1
 * @param {Number} y1
 * @param {Number} x2
 * @param {Number} y2
 * @param {Number} x3
 * @param {Number} y3
 * @returns {Object}
 */
function circleFromPoints(x1, y1, x2, y2, x3, y3) {
  // from Robert Eisele
  const a = x1 * (y2 - y3) - y1 * (x2 - x3) + x2 * y3 - x3 * y2;

  const b = (x1 * x1 + y1 * y1) * (y3 - y2)
          + (x2 * x2 + y2 * y2) * (y1 - y3)
          + (x3 * x3 + y3 * y3) * (y2 - y1);

  const c = (x1 * x1 + y1 * y1) * (x2 - x3)
          + (x2 * x2 + y2 * y2) * (x3 - x1)
          + (x3 * x3 + y3 * y3) * (x1 - x2);

  const x = -b / (2 * a);
  const y = -c / (2 * a);
  return {
    x: x,
    y: y,
    r: Math.hypot(x - x1, y - y1),
  }
}

/**
 * Create an icon that shows the current moon phase based on the Dark Sky moonPhase number
 * @param {Number} moonPhase
 * @param {String} color
 */
function showMoonPhase(moonPhase, color) {
  const canvas = document.getElementById('mooncons');
  const smallDim = Math.min(canvas.width, canvas.height); // get smallest dimension
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height); // clear the canvas just in case
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;

  const lineWidth = smallDim*0.1375; // seems to be about the right proportion
  ctx.lineWidth = lineWidth;
  const radius = smallDim/2 - lineWidth/2; // largest radius that will fit
  const mid = smallDim/2; // get the midpoint of the smallest dimension - might be off-center but it should fit
  const calcMidPoint = (mid+radius)-(moonPhase%.5)*radius*4; // *4 'cause it's going from 0 to .5 and not 0 to 1
  const otherArc = circleFromPoints(mid, mid-radius, mid, mid+radius, calcMidPoint, mid);

  const PI = Math.PI;
  // the y coordinates of the center points are the same, so opposite is the moon radius, and hypotenuse is the otherArc radius
  // and we can use the same angle because the moon is symmetrical across the horizontal axis
  const endpointAngle = Math.asin(radius / otherArc.r);

  ctx.beginPath();
  if ((moonPhase < .25 && moonPhase > 0) || (moonPhase > .5 && moonPhase < .75)) { // right-side curve )
    ctx.arc(otherArc.x, otherArc.y, otherArc.r, 2*PI-endpointAngle, endpointAngle);
  }
  else if ((moonPhase > .25 && moonPhase < .5) || (moonPhase > .75 && moonPhase < 1)) { // left-side curve (
    ctx.arc(otherArc.x, otherArc.y, otherArc.r, PI+endpointAngle, PI-endpointAngle, true);
  }
  else if (moonPhase === .25 || moonPhase === .75) { // straight line for half moons
    ctx.moveTo(mid, mid-radius);
    ctx.lineTo(mid, mid+radius);
  }
  ctx.stroke();

  ctx.beginPath();
  if (moonPhase < 0.5 && moonPhase > 0) { // regular right half
    ctx.arc(mid, mid, radius, 1.5*PI, .5*PI);
  }
  else if (moonPhase > 0.5) { // regular left half
    ctx.arc(mid, mid, radius, .5*PI, 1.5*PI);
  }
  else { // whole and new moons
    ctx.arc(mid, mid, radius, 0, 2*PI);
    if (moonPhase === 0) { // fill for new moon
      ctx.fillStyle = '#363636';
      ctx.fill();
    }
  }
  ctx.stroke();
  
  if (moonPhase === 0) {
    canvas.title = 'New moon';
  }
  else if (moonPhase === 1) {
    canvas.title = 'Full moon';
  }
}

/**Request and show weather from Dark Sky*/
function getWeather() {
  if (document.hidden) {
    updateWeatherWhenNextActive = true;
    return;
  }
  weather.style.height = ''; // unfix height so it doesn't keep growing
  weather.style.width = '';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      const API_KEY = config.darkSkyKey;
      const CORS_SOURCE = config.corsSource;

      const lat = p.coords.latitude;
      const lon = p.coords.longitude;

      fetch(
        CORS_SOURCE + `https://api.darksky.net/forecast/${API_KEY}/${lat},${lon}?exclude=[flags,minutely]`,
        { method: 'GET' }
      ).then( response => response.json())
      .then(json => {
        console.log(json);
        const { // current data
          summary,
          apparentTemperature: temperature,
          icon,
          windSpeed,
          windGust = null,
          windBearing,
          humidity,
          visibility,
        } = json.currently;

        const { // today's data
          sunriseTime,
          sunsetTime,
          moonPhase,
        } = json.daily.data[0];
        saveMoonPhase = moonPhase;

        crepuscs.dawn = sunriseTime; // for checking if the current time is during the daytime
        crepuscs.dusk = sunsetTime;

        const getSkyconColor = skyconColor();
        if (skycon == null) {
          skycon = new Skycons({color: getSkyconColor});
          skycon.add('skycons', icon);
          skycon.play();
        }
        else {
          skycon.set('skycons', getSkyconColor, icon);
        }

        weather.getElementsByClassName('curTemp')[0].textContent = temperature + '°';

        // predict temperature changes based on the temp for the next hour
        const tempPrediction = json.hourly.data[1].apparentTemperature > temperature ? 'rising' : 'falling';
        weather.getElementsByClassName('tempPrediction')[0].textContent = `and ${tempPrediction}`;
        weather.getElementsByClassName('summary')[0].textContent = summary;

        const wind = `${windSpeed} mph (${degrToHeds(windBearing)})`;
        const maybeWindGust = windGust == null ? '' : ` Gusts up to ${windGust} mph`;
        weather.getElementsByClassName('wind')[0].textContent = `Wind: ${wind}\r\n${maybeWindGust}`;

        showMoonPhase(moonPhase, getSkyconColor);

        weather.getElementsByClassName('sunrise')[0].textContent = `Sunrise: ${simpleTime(new Date(sunriseTime*1000))}`;
        weather.getElementsByClassName('sunset')[0].textContent = `Sunset: ${simpleTime(new Date(sunsetTime*1000))}`;
        weather.getElementsByClassName('location')[0].textContent =
        `Weather for ${Math.abs(Math.round(lat))}° ${lat > 0 ? 'N' : 'S'}, ${Math.abs(Math.round(lon))}° ${lon > 0 ? 'E' : 'W'}`;

        const showDays = weather.getElementsByClassName('day');
        const showHighs = weather.getElementsByClassName('high');
        const showExtrema = weather.getElementsByClassName('showExtrema');
        const showLows = weather.getElementsByClassName('low');
        const showPrecip = weather.getElementsByClassName('precipProbability');

        const today = new Date().getDay();
        const daysData = json.daily.data;

        // also has apparentTemperatureLow and High:
        // low is overnight low temp, high is daytime high, max and min are just largest and smallest values
        const weekMax = Math.max.apply(Math, daysData.map(i => i.apparentTemperatureMax));
        const weekMin = Math.min.apply(Math, daysData.map(i => i.apparentTemperatureMin));
        const scaleMinMax = weekMax - weekMin;

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        for (let [idx, item] of daysData.entries()) { // the next week
          const { // daily data
            apparentTemperatureMax: highTemp,
            apparentTemperatureMin: lowTemp,
            icon,
            precipType = '',
            precipProbability,
          } = item;

          if (idx < daysData.length-1) {
            showDays[idx+1].textContent = days[(today + 1 + idx) % days.length].slice(0, 3); // only first three letters so it fits
          }
          showHighs[idx].textContent = highTemp + '°';
          showLows[idx].textContent = lowTemp + '°';

          const barTop = (weekMax - highTemp) * 90/scaleMinMax; // scale to fit 90px tall
          const tempHeight = (highTemp - lowTemp) * 90/scaleMinMax;

          showExtrema[idx].style.height = tempHeight + 'px';
          showExtrema[idx].style.top = barTop + 20 + 'px';

          showHighs[idx].style.top = barTop + 'px';
          showLows[idx].style.top = barTop + tempHeight + 20 + 'px';

          if (smallSkycons.length < daysData.length) {
            smallSkycons.push(new Skycons({color: getSkyconColor}));
            smallSkycons[idx].add(showIcons[idx], icon);
            smallSkycons[idx].play();
          }
          else {
            smallSkycons[idx].set(showIcons, getSkyconColor, icon);
          }

          const precipPercent = precipType === '' ? '' : `: ${Math.round(precipProbability*100)}%`;
          showPrecip[idx].textContent = `${precipType.charAt(0).toUpperCase()}${precipType.slice(1)}${precipPercent}`;
        }

        weather.getElementsByClassName('humidity')[0].textContent = `Humidity: ${Math.round(humidity*100)}%`;
        weather.getElementsByClassName('visibility')[0].textContent =
            `Visibility: ${visibility} ${visibility === 1 ? 'mile' : 'miles'}`;
        
        const alerts = json.alerts || null;
        if (alerts != null) {
          const showAlert = weather.getElementsByClassName('alert')[0]
          showAlert.textContent = `${alerts[0].title}`;
          showAlert.title = alerts[0].description;
          showAlert.href = alerts[0].uri;
        }
      }).then(() => {
        if (options.weatherMatchMode || options.timeMatchMode) {
         autoDarkMode(); // now, set dark mode automatically
        }
        weather.style.height = weather.offsetHeight + 'px'; // fix height so it can be dragged around
        weather.style.width = weather.offsetWidth + 'px';
        if (otherCoords.weather !== {}) {
          weather.style.left = otherCoords.weather.x + 'px'; // only then set position - otherwise it gets all stretched
          weather.style.top = otherCoords.weather.y + 'px';
        }
      });
    });
  }
}

/**Set weather interval*/
function getUpdateWeather() {
  getWeather();
  weatherInterval = setInterval(getWeather, 600000); // update every ten minutes - maybe make faster?
}

/**
 * Remove extra stuff from the end of links to try and get the favicon successfully
 * @param {string} url
 * @returns {string}
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
 * @param {String} link Website to scrape favicon from
 */
function setIconSrc(icon, link) {
  if (link.includes('mail.google')) {
    icon.src = 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico';
  }
  else if (link.includes('google')) {
    let gService;
    if ( // for non-docs services
      link.includes('calendar') ||
      link.includes('keep') ||
      link.includes('drive') ||
      link.includes('photos') ||
      link.includes('translate')
    ) {
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
  else {
    icon.src = baseLink(link) + '/favicon.ico';
  }
  return icon.src;
}

/**
 * Generate a new link and add it to the DOM
 * @param {String} url
 * @param {String} name
 * @param {Number} x
 * @param {Number} y
 * @param {boolean} nue
 */
function newLink(obj) {
  const {
    url,
    name,
    iconSrc = null,
    x = null,
    y = null,
    makeNew = false,
  } = obj

  const template = document.getElementById('linkTemplate');
  const clone = template.content.cloneNode(true);
  
  let tempurl = url;
  !url.includes('http') && !url.includes('file:') && (tempurl = 'https://' + url);

  clone.querySelector('a').href = tempurl;

  const icon = clone.querySelector('img');

  // Set error handler
  // last resort, use google's favicon finder
  icon.onerror = () => icon.src = 'https://s2.googleusercontent.com/s2/favicons?domain_url=' + tempurl;

  // Then try to get the favicon
  /* iconSrc == null ?  */setIconSrc(icon, tempurl) /* : (icon.src = iconSrc); */

  clone.querySelector('.linkTitle').textContent = name;

  if (x != null && y != null) { // if it has a position, put it in the body at the right coordinates
    const container = clone.querySelector('.linkContainer');
    container.style.position = 'absolute';
    container.style.left = x + 'px';
    container.style.top = y + 'px';

    document.body.appendChild(clone);
  }
  else { // else, put it in the container and move the plus btn to the end
    links.appendChild(clone);
  }

  if (makeNew) {
    setIconSrc(icon, url);
    allLinks.push({ url: tempurl, name: name, iconSrc: icon.src });
    urlInput.value = '';
    titleInput.value = '';
    plusmoda.classList.remove('inlineBlock');
    shadow.classList.add('none');
  }
  return icon.src;
}

/**Close all modals*/
function closeAll() {
  plusmoda.classList.remove('inlineBlock');
  editmoda.classList.remove('inlineBlock');
  optmoda.classList.remove('inlineBlock');
  shadow.classList.add('none');
  if (optopen) { // set options correctly
    for (let key in optionsElements) {
      options[key] = optionsElements[key].checked;
    }
    optopen = false;
  }
  chrome.storage.sync.set({options: options}, () => {});
  chrome.storage.sync.set({links: allLinks}, () =>{});
}

/**Save edits on a link*/
function save() {
  setIconSrc(getLink.children[0], changeurl.value);
  getLink.children[1].textContent = changename.value;
  getLink.href = changeurl.value;
  linkInArray.name = changename.value;
  linkInArray.url = getLink.href; // 'cause it adds a slash sometimes
  closeAll();
}

/**Add a new link*/
function addLink() {
  if (urlInput.value !== '' && titleInput.value !== '') {
    newLink({url: urlInput.value, name: titleInput.value, makeNew: true});
    chrome.storage.sync.set({links: allLinks}, () => {});
  }
  else {
    alert(`You haven't filled out all the fields.`);
  }
}

/**
 * Insert a string at the specified index into another string
 * @param {String} string
 * @param {Number} index
 * @param {String} insertValue
 */
const insertString = (string, index, insertValue) => string.slice(0, index) + insertValue + string.slice(index);

/**
 * Match multiple potential selectors
 * @param {HTMLElement} e
 * @param  {...String} targets
 */
function multiMatch(e, ...targets) {
  for (let i of targets) {
    if (e.matches(i)) {
      return true;
    }
  }
  return false;
}

/**
 * Set up for dragging an element
 * @param {HTMLElement} e
 */
function setDrag(e) {
  if (dragTarg == null) {
    return;
  }
  const bound = dragTarg.getBoundingClientRect(dragTarg);
  startX = e.clientX;
  startY = e.clientY;
  xOffset = bound.x - e.clientX;
  yOffset = bound.y - e.clientY;
  predrag = true;
  positions.length = 0;
  for (let i of containers) {
    if (i.offsetLeft !== undefined && i !== dragTarg) { // don't add the dragged element, or there would be a ghost of it that it would hit
      positions.push({
        left: i.offsetLeft,
        right: i.offsetLeft + i.offsetWidth,
        top: i.offsetTop,
        bottom: i.offsetTop + i.offsetHeight,
      });
    }
  }
  document.addEventListener('mousemove', doDragging, { useCapture: false});
}

/**
 * @param {Event} e
 */
function doDragging(e) { // for mousemove event listener, removed when mouse is up
  e.preventDefault(); // prevent highlighting and normal link dragging
  if (predrag) { // all the stuff that should only happen once
    predrag = false;

    if (dragTarg.matches('.linkContainer')) {
      dragTarg.getElementsByClassName('edit')[0].style.display = 'none'; // hide edit button while dragging a link
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

  if (!dragTarg || framePending || ((Math.abs(startX - e.clientX) + Math.abs(startY - e.clientY)) < 30 && !dragging)) {
    return;
  }
  framePending = true;
  requestAnimationFrame(() => {
    dragging = true;
    framePending = false;
    let yboundary = false; // for telling if it's hitting the sides I think
    let xboundary = false;
    const xCorr = e.clientX + xOffset;
    const yCorr = e.clientY + yOffset;

    if (xCorr < 1) { // left
      dragTarg.style.left = options.optLinksGrid ? '8px' : '0';
      xboundary = true;
    }
    else if (xCorr + dragTarg.offsetWidth > window.innerWidth) { // right
      dragTarg.style.left = window.innerWidth - dragTarg.offsetWidth + 'px';
      xboundary = true;
    }
    if (yCorr < 1) { // top
      dragTarg.style.top = '0';
      yboundary = true;
    }
    else if (yCorr + dragTarg.offsetHeight > window.innerHeight) { // bottom
      dragTarg.style.top = window.innerHeight - dragTarg.offsetHeight + 'px';
      yboundary = true;
    }
    if (!options.optoverlap && dragTarg.matches('.linkContainer')) { // check for overlap on other links
      for (let i of positions) {
        if ( // lined up on the y-axis
        (dragTarg.offsetTop >= i.top && dragTarg.offsetTop <= i.bottom) ||
        (dragTarg.offsetTop + dragTarg.offsetHeight >= i.top && dragTarg.offsetTop + dragTarg.offsetHeight <= i.bottom) ||
        (dragTarg.offsetTop <= i.top && dragTarg.offsetTop + dragTarg.offsetHeight >= i.bottom)) {
          if ( // to the right
          xCorr < i.right + 9.5 &&
          xCorr > i.left - 9.5) {
            dragTarg.style.left = i.right + 3.5 + 'px';
            xboundary = true;
            break;
          }
          else if ( // to the left, or dragTarg encloses (default to left)
          (xCorr + dragTarg.offsetWidth < i.right + 10 &&
          xCorr + dragTarg.offsetWidth > i.left - 10) ||
          (xCorr < i.left + 10 &&
          xCorr + dragTarg.offsetWidth > i.right - 10)) {
            dragTarg.style.left = i.left - dragTarg.offsetWidth - 9.5 + 'px';
            xboundary = true;
            break;
          }
        }
      }
    }

    // if nothing is colliding
    !xboundary && (dragTarg.style.left = e.clientX + xOffset + 'px');

    if (!yboundary) {
      if (
      ((options.optTimeGrid && dragTarg.matches('#time')) || // or dragging time and snap time
      (options.optLinksGrid && !dragTarg.matches('#time'))) // or not dragging time and snap links
      && multiMatch(dragTarg, '.linkContainer', '#time')) { // never snap weather or system links
        dragTarg.style.top = (Math.trunc((e.clientY - 8) / 45) * 45 + timeYOffset + 8) + 'px';
      }
      else {
        dragTarg.style.top = e.clientY + yOffset + 'px';
      }
    }
  });
}

chrome.storage.onChanged.addListener(changes => {
  for (let key of Object.keys(changes)) {
    setFromStorage[key](changes[key].newValue);
  }
});

document.addEventListener('click', e => { // reset, edit, save, and delete
  if (postdrag) {
    e.preventDefault();
    postdrag = false;
  }
  if (e.target.matches('.edit')) { // open the edit modal
    predrag = false;
    getLink = e.target.parentNode.getElementsByTagName('a')[0];
    editmoda.classList.add('inlineBlock');
    shadow.classList.remove('none');
    changename.value = getLink.textContent;
    changeurl.value = getLink.href;
    changename.focus();
    allLinks.find(i => { // find the current link in the allLinks array
      i.url === getLink.href && (linkInArray = i);
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
  else if (e.target.matches('#plusbtn')) { // open new link modal
    plusmoda.classList.add('inlineBlock');
    shadow.classList.remove('none');
    urlInput.focus();
  }
  else if (e.target.matches('#addbtn')) { // add a new link
    addLink();
  }
  else if (e.target.matches('#showNotes')) { // show/hide notes
    options.showNotes = !options.showNotes;
    notes.classList.toggle('none');
    if (notesBody.offsetHeight - 6 !== noteSize.height) {
      notesBody.style.height = noteSize.height + 'px';
      notesBody.style.width = noteSize.width + 'px';
    }
  }
  else if (e.target.matches('#options')) { // open options modal
    optmoda.classList.add('inlineBlock');
    shadow.classList.remove('none');

    for (let key in optionsElements) {
      optionsElements[key].checked = options[key];
    }

    optopen = true;
  }
  else if (e.target.matches('#showWeather')) { // change show weather settings
    weather.classList.toggle('none');
    if (showWeather.checked) { // if now showing weather, get it and set update interval
      getUpdateWeather();
    }
    else { // stop updating weather
      clearInterval(weatherInterval);
    }
  }
  else if (e.target.matches('#showSysLinks')) {
    system.classList.toggle('none');
  }
  else if (e.target.matches('#darkMode')) { // switch light/dark mode
    // needs to change options right here because it calls changeMode immediately and that reads from options
    options.darkMode = !options.darkMode;
    weatherMatchMode.checked = false; // unset matching if set dark mode manually
    timeMatchMode.checked = false;
    options.weatherMatchMode = false;
    options.timeMatchMode = false;
    changeMode();
  }
  else if (e.target.matches('#weatherMatchMode')) {
    options.weatherMatchMode = !options.weatherMatchMode; // toggle weatherMatchMode
    autoDarkMode(); // change dark mode accordingly
  }
  else if (e.target.matches('#timeMatchMode')) {
    options.timeMatchMode = !options.timeMatchMode;
    autoDarkMode();
  }
  else if (e.target.closest('#system') && !e.target.matches('#system') && !dragging) { // prevent system links from linking
    e.preventDefault(); // do stuff on mouseup
  }
  else if (e.target.matches('#downloadsFolder')) {
    chrome.downloads.showDefaultFolder();
  }
  else if (e.target.matches('#newback')) { // change the background
    newBackground();
  }
  else if (e.target.matches('.cnclbtn')) { // cancel and close modals
    closeAll();
  }
  else if (e.target.matches('.resetWeather') && !dragging) { // reset the weather div to its default position
    dragTarg = null;
    weather.style.left = '';
    weather.style.top = '';
    otherCoords.weather = {};
    chrome.storage.sync.set({otherCoords: otherCoords}, () => {});
  }
  else if (e.target.matches('#showSeconds')) { // show or hide seconds
    options.showSeconds = showSeconds.checked;
  }
  dragging = false;
}, false);

document.addEventListener('mousedown', e => { // for dragging, and closing modals
  if (!e.target.closest('.moda')) { closeAll(); }
  if (e.button !== 1 && e.button !== 2) { // don't drag on middle click or right click
    if (e.target.closest('.linkContainer') && !e.target.matches('.edit')) {
      dragTarg = e.target.closest('.linkContainer');
    }
    else if (e.target.matches('#time')) {
      dragTarg = e.target;
    }
    else if (e.target.closest('#weather')) {
      dragTarg = e.target.closest('#weather');
    }
    else if (e.target.closest('#system')) {
      dragTarg = e.target.closest('#system');
    }
    else if (e.target.closest('#notes') && !e.target.matches('#notesBody')) {
      dragTarg = e.target.closest('#notes');
    }
    setDrag(e);
  }
}, false);

document.addEventListener('mouseup', e => {
  document.removeEventListener('mousemove', doDragging, {passive: true, useCapture: false});
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
      dragTarg.getElementsByClassName('edit')[0].style.display = ''; // unhide edit button when dropped
      const fixlink = dragTarg.getElementsByTagName('a')[0].href;
      allLinks.find(i => {
        if (fixlink === i.url) {
          i.x = dragTarg.offsetLeft - 3; // I don't know why this correction is necessary - body offset?
          i.y = dragTarg.offsetTop - 3;
        }
      });
    }
    else if (dragTarg.matches('#time')) {
      otherCoords.time = {x: time.offsetLeft, y: time.offsetTop};
    }
    else if (dragTarg.matches('#weather')) {
      otherCoords.weather = {x: weather.offsetLeft, y: weather.offsetTop};
    }
    else if (dragTarg.matches('#system')) {
      otherCoords.systemLinks = {x: system.offsetLeft, y: system.offsetTop};
    }
    else if (dragTarg.matches('#notes')) {
      otherCoords.notes = {x: notes.offsetLeft, y: notes.offsetTop};
    }
    dragTarg = null;
    chrome.storage.sync.set({links: allLinks}, () => {});
    chrome.storage.sync.set({otherCoords: otherCoords}, () => {});
  }
  else if (e.target.closest('#system') && !e.target.matches('#system') && e.button !== 2) { // open system links
    e.preventDefault();
    if (e.button === 1 || e.ctrlKey) { // button three or holding control opens in new tab
      chrome.tabs.create({url: 'chrome://' + e.target.id, active: false});
    }
    else { // otherwise, change current tab
      chrome.tabs.update(null, {url: 'chrome://' + e.target.id});
    }
  }
  else if (e.target.matches('#notesBody')) {
    noteSize = {width: notesBody.offsetWidth - 6, height: notesBody.offsetHeight - 6}
    chrome.storage.sync.set({noteSize: noteSize}, () => {});
  }
}, false);

document.addEventListener('keydown', e => { // escape for modals and enter to do default action
  if (e.key === 'Escape') { // Escape
    closeAll();
  }
  else if (e.key === 'Enter') { // enter
    if (editmoda.matches('.inlineBlock')) {
      save();
    }
    else if (plusmoda.matches('.inlineBlock')) {
      addLink();
    }
  }
  if (document.activeElement.matches('#notesBody')) { // all notes key stuff
    const startPos = notesBody.selectionStart;
    const lines = notesBody.value.split('\n');
    const currentLineNum = notesBody.value.slice(0, startPos).split('\n').length;
    const oldLine = lines[currentLineNum - 1];
    
    switch(e.key) {
    case 'Enter':
      if (/^ +- \S/.test(oldLine)) {
        e.preventDefault();
        const numSpaces = oldLine.indexOf('-');
        notesBody.value = insertString(notesBody.value, startPos, `\n${' '.repeat(numSpaces)}- `);
        notesBody.selectionEnd = startPos + numSpaces + 3;
      }
      else if (/^ +\* \S/.test(oldLine)) {
        e.preventDefault();
        const numSpaces = oldLine.indexOf('*');
        notesBody.value = insertString(notesBody.value, startPos, `\n${' '.repeat(numSpaces)}* `);
        notesBody.selectionEnd = startPos + numSpaces + 3;
      }
      else if (/^ +(-|\*) /.test(oldLine) && !/\S/.test(oldLine.slice(oldLine.search(/-|\*/) + 1))) { // on
        e.preventDefault();
        lines.splice(currentLineNum - 1, 1, '');
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
      if (/^ {2,}(-|\*)/.test(oldLine) && e.shiftKey) { // tab back out
        lines.splice(currentLineNum - 1, 1, oldLine.slice(2));
        notesBody.value = lines.join('\n');
        notesBody.selectionEnd = startPos - 2;
      }
      // tab in
      else if (/^ +(-|\*)/.test(oldLine) && !/\S/.test(oldLine.slice(oldLine.search(/-|\*/) + 1)) && !e.shiftKey) {
        lines.splice(currentLineNum - 1, 1, '  ' + oldLine);
        notesBody.value = lines.join('\n');
        notesBody.selectionEnd = startPos + 2;
      }
      else if (!e.shiftKey) {
        notesBody.value = insertString(notesBody.value, startPos, '  ');
        notesBody.selectionEnd = startPos + 2;
      }
    break;
    case 'K': // Ctrl+Shift+K removes a line like in VSCode
      if (e.ctrlKey) {
        lines.splice(currentLineNum - 1, 1);
        notesBody.value = lines.join('\n');
      }
    break;
    default:
    }
    notesBody.dispatchEvent(new KeyboardEvent('input'));
  }
}, false);

notesBody.addEventListener('input', () => {
  noteText = notesBody.value;
  chrome.storage.sync.set({notes: noteText}, () => {});
}, false);

window.addEventListener('focus', () => {
  if (updateWeatherWhenNextActive) {
    getWeather();
    updateWeatherWhenNextActive = false;
  }
}, false);
