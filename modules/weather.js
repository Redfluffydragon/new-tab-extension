import Spline from './cubic-spline.js';
import { toSeconds } from './parse-duration.js';
import {parse} from './tinyduration.js';
import Skycons from './skycons.js';
import { simpleTime } from './utils.js';

const DISPLAY_DAYS = 8;

const weather = document.getElementById('weather');
const showIcons = weather.getElementsByClassName('smallSkycon'); // for starting and changing small week skycons

// Exported variables
export let skycon = null; // for big current skycon
export const crepuscs = {}; // dawn and dusk
export let isNight = false;

let smallSkycons = []; // for storing small skycons for changing colors
let saveMoonPhase = 0; // for passing the moon phase between functions

let weatherInterval; // for setInterval for updating weather
let updateWeatherWhenNextActive; // don't update weather when not active, but update it when next active

const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
/**
 * Turn wind direction degrees into a heading
 * @param {Number} degrees
 */
const degrToHeds = degrees => headings[Math.trunc((degrees + 22.5) / 45)];

/**Get the correct Skycon color based on dark mode*/
const getSkyconColor = () => _options.darkMode ? '#888888' : '#333';

let _callback = () => { };
let _options = {};

const leadingZero = number => ('0' + number).slice(-2);

const dateString = date => `${date.getFullYear()}-${leadingZero(date.getMonth() + 1)}-${leadingZero(date.getDate())}`;

function WMOMap(code) {
  switch (code) {
    case 0:
      return 'CLEAR_DAY';
    case 1:
    case 2:
      return 'PARTLY_CLOUDY_DAY';
    case 3:
      return 'CLOUDY';
    case 51:
    case 53:
    case 55:
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
    case 95:
    case 96:
    case 99:
      return 'RAIN';
    case 56:
    case 57:
    case 66:
    case 67:
      return 'SLEET';
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return 'SNOW';
    case 45:
    case 48:
      return 'FOG';
  }
  return 'CLEAR_DAY';
}

function skyconID(code, isNight, windspeed) {
  let id = WMOMap(code);
  if (isNight) {
    id = id.replace('DAY', 'NIGHT');
  }
  if (code <= 3 && windspeed > 20) {
    id = 'WIND';
  }
  return id;
}

/**
 * Initialize weather
 * @param {Function} callback A callback function that will be called every time the weather is updated
 * @param {*} options An options object with field "darkMode" for setting weather colors
 */
export function initialize(callback, options) {
  callback && (_callback = callback);
  _options && (_options = options);
}

/**Set weather interval*/
export function getUpdateWeather() {
  getWeather();
  weatherInterval = setInterval(getWeather, 600000); // update every ten minutes - maybe make faster?
}

/** Stop weather from updating */
export function stopWeather() {
  clearInterval(weatherInterval);
}

/** Change light/dark mode for weather */
export function changeWeatherMode() {
  const skyconColor = getSkyconColor();
  skycon.set('skycons', skyconColor);
  changeSkyconColors(skyconColor);
  showMoonPhase(saveMoonPhase, skyconColor);
}

async function fetchWeather(lat, lon) {
  const gridpoint = await (await fetch(`https://api.weather.gov/points/${lat},${lon}`)).json();
  console.log(gridpoint.properties);

  const today = new Date();
  const start = dateString(today);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const end = dateString(nextWeek);

  return await Promise.all([
    fetch(gridpoint.properties.forecastHourly).then(r => r.json()),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation,weathercode,surface_pressure,visibility,windspeed_10m,winddirection_10m,windgusts_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_hours,windspeed_10m_max&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto&start_date=${start}&end_date=${end}`
    ).then(r => r.json()),
    fetch(gridpoint.properties.forecastGridData).then(r => r.json()),
    gridpoint,
  ]);
}

function isBetween(val, low, high) {
  return val >= low && val <= high;
}

function rangesOverlap(start1, end1, start2, end2) {
  return isBetween(start1, start2, end2) || isBetween(end1, start2, end2)
    || isBetween(start2, start1, end1) || isBetween(end2, start1, end1);
}

function endPointsFromDuration(time) {
  const start = Date.parse(time.match(/^[^/]+/));
  const duration = toSeconds(parse(time.match(/[^/]+$/)[0]), new Date(start));
  const end = start + duration * 1000;
  return [start, end];
}

function compilePrecipProbablity(probabilities, weather) {
  if (!probabilities?.length) {
    return [];
  }

  const dailyPrecip = Array.from(Array(8), () => ({ type: new Set, chance: 0 }));

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let day = 0; day < DISPLAY_DAYS; day++) {
    const dayStart = now.getTime();
    now.setDate(now.getDate() + 1);
    const dayEnd = now.getTime();

    let maxIdx = 0;
    for (const period of probabilities) {
      if (period.value < 10) {
        continue;
      }

      const [start, end] = endPointsFromDuration(period.validTime);

      if (rangesOverlap(dayStart, dayEnd, start, end) && period.value > dailyPrecip[day].chance) {
        dailyPrecip[day].chance = period.value;
        maxIdx = probabilities.indexOf(period);
      }
    }

    const [pStart, pEnd] = endPointsFromDuration(probabilities[maxIdx].validTime);

    for (const weatherPeriod of weather) {
      const [wStart, wEnd] = endPointsFromDuration(weatherPeriod.validTime);

      if (rangesOverlap(wStart, wEnd, pStart, pEnd)) {
        const typeString = weatherPeriod?.value?.[0]?.weather?.replaceAll('_', ' ');
        typeString && dailyPrecip[day].type.add(typeString);
      }
    }
    dailyPrecip[day].type = [...dailyPrecip[day].type].join(' / ');
  }

  return dailyPrecip.map(day => ({
    type: day.type,
    chance: day.chance,
  }));
}

/**Request and show weather from Dark Sky*/
async function getWeather() {
  if (document.hidden) {
    updateWeatherWhenNextActive = true;
    return;
  }
  weather.style.height = ''; // unfix height so it doesn't keep growing
  weather.style.width = '';

  if (!navigator.geolocation) { // requires the use of geolocation
    return;
  }
  const position = await new Promise(resolve => navigator.geolocation.getCurrentPosition(resolve));

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  const [govHourly, meteoWeather, govRaw] = await fetchWeather(lat, lon);

  console.log(govRaw.properties);
  console.log(govHourly.properties?.periods);
  console.log(meteoWeather);

  const moonPhase = 0;

  const {
    hourly,
    daily,
    current_weather: meteoCurrent,
  } = meteoWeather;

  const current = govHourly.properties?.periods[1] || {};

  const lastTime = hourly.time.findIndex(time => Date.parse(time) > Date.now()) - 1;

  function lerpWeather(data, round = false) {
    const currentHour = hourly.time.slice(lastTime, lastTime + 2).map(time => Date.parse(time));
    const hourPercent = (Date.now() - currentHour[0]) / (currentHour[1] - currentHour[0]);
    const lerped = hourPercent * (data[lastTime + 1] - data[lastTime]) + data[lastTime];
    return round ? Math.round(lerped) : lerped;
  }

  // Current temperature
  let xs = [], ys = [];
  for (let i = 0; i < 3; i++) {
    const period = govHourly.properties?.periods[i] || {};
    xs.push(Date.parse(period.startTime) + 1800000);
    ys.push(period.temperature);
  }

  const temperatureSpline = new Spline(xs, ys);
  const temperature = Math.round(temperatureSpline.at(Date.now()) * 10) / 10;

  weather.querySelector('.curTemp').textContent = temperature + '°';

  // predict temperature changes based on the temp for the next hour
  const tempTrend = govHourly.properties?.periods[2].temperature > temperature ? 'rising' : 'falling';
  weather.querySelector('.tempPrediction').textContent = `and ${tempTrend}`;
  weather.querySelector('.summary').textContent = govHourly.properties?.periods[0].shortForecast || '';

  // Sunrise/sunset and night
  const sunriseTime = new Date(daily.sunrise[0]);
  const sunsetTime = new Date(daily.sunset[0]);

  weather.querySelector('.sunrise').textContent = `Sunrise: ${simpleTime(new Date(sunriseTime))}`;
  weather.querySelector('.sunset').textContent = `Sunset: ${simpleTime(new Date(sunsetTime))}`;

  const now = new Date();
  isNight = now < sunriseTime || now > sunsetTime;

  // Main skycon
  const skyconColor = getSkyconColor();
  // TODO select skycon based on NOAA data? Or something
  const icon = skyconID(meteoCurrent.weathercode, isNight, parseFloat(current.windSpeed?.split(' ')));

  if (skycon == null) {
    skycon = new Skycons({ color: skyconColor });
    skycon.add('skycons', icon);
    skycon.play();
  }
  else {
    skycon.set('skycons', skyconColor, icon);
  }

  // Wind
  const windGust = hourly.windgusts_10m[lastTime + 1];
  const wind = `${current.windSpeed} (${current.windDirection})`;
  weather.querySelector('.wind').textContent = `Wind: ${wind}\r\n${windGust ? ` Gusts up to ${windGust} mph` : ''}`;

  // Moon phase
  saveMoonPhase = moonPhase; // TODO get moon phase
  showMoonPhase(moonPhase, skyconColor);

  // Display your current coordinates
  const latDir = lat > 0 ? 'N' : 'S';
  const lonDir = lon > 0 ? 'E' : 'W';
  weather.querySelector('.location').textContent =
    `Weather for ${Math.abs(Math.round(lat))}° ${latDir}, ${Math.abs(Math.round(lon))}° ${lonDir}`;

  // Weather for the next week
  const weekMax = Math.max(...daily.temperature_2m_max);
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekRange = weekMax - weekMin;

  const precipitation = compilePrecipProbablity(govRaw.properties.probabilityOfPrecipitation?.values, govRaw.properties.weather.values);

  setTempGradient(weekMin, weekRange);

  showWeekForecast(daily, weekMax, weekRange, skyconColor, precipitation);

  // Humidity
  const humidity = lerpWeather(hourly.relativehumidity_2m);
  weather.querySelector('.humidity').textContent = `Humidity: ${Math.round(humidity)}%`;

  // Visibility
  const visibility = Math.round(lerpWeather(hourly.visibility) * 0.000621371192);
  weather.querySelector('.visibility').textContent =
    `Visibility: ${visibility} ${visibility === 1 ? 'mile' : 'miles'}`;

  //https://alerts.weather.gov/cap/wwacapget.php?x=CO126630E25290.WinterStormWatch.1266310E87C0CO.BOUWSWBOU.089f7024ebf644a293203c3aafe2ef57
  // Alerts
  fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`)
    .then(r => r.json())
    .then(alerts => {
      console.log('Alerts:', alerts);
      showAlerts(alerts.features);
    });

  _callback(); // call the callback after all weather data is processed
}

/** Set the temperature gradient scale and position for all days */
function setTempGradient(min, range) {
  const maxTemp = 140;
  const minTemp = -90;
  const absTempRange = maxTemp - minTemp;

  const bgScale = absTempRange / range * 100;
  document.documentElement.style.setProperty('--bg-scale', bgScale + '%');

  const centerTemp = min + range / 2;
  document.documentElement.style.setProperty('--bg-pos', ((140 - centerTemp) / absTempRange) * 100 + '%');
}

/**
 * Display the forecast for the upcoming week 
 * @param {*} data The weather data for the next week
 * @param {number} weekMax The maximum temperature for the next week
 * @param {number} weekRange The temperature range for the next week
 * @param {string} skyconColor The color for the skycons
 */
function showWeekForecast(data, weekMax, weekRange, skyconColor, precipitation) {
  const showDays = weather.getElementsByClassName('day');
  const showHighs = weather.getElementsByClassName('high');
  const showExtrema = weather.getElementsByClassName('showExtrema');
  const showLows = weather.getElementsByClassName('low');
  const showPrecip = weather.getElementsByClassName('precipProbability');

  const today = new Date().getDay();

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  showDays[0].textContent = 'Today'; // set it with js so it looks better before weather loads

  for (let i = 0; i < DISPLAY_DAYS; i++) {
    const highTemp = data.temperature_2m_max[i];
    const lowTemp = data.temperature_2m_min[i];
    const icon = skyconID(data.weathercode[i], false, data.windspeed_10m_max[i]);

    if (i > 0) {
      showDays[i].textContent = days[(today + i) % days.length];
    }

    showHighs[i].textContent = Math.round(highTemp) + '°';
    showLows[i].textContent = Math.round(lowTemp) + '°';

    const barTop = (weekMax - highTemp) * 90 / weekRange; // scale to fit 90px tall
    const tempHeight = (highTemp - lowTemp) * 90 / weekRange;

    showExtrema[i].style.clipPath =
      `inset(${Math.round(barTop)}px 0 ${Math.round(90 - barTop - tempHeight)}px 0 round 8px)`;

    if (smallSkycons.length < DISPLAY_DAYS) {
      smallSkycons.push(new Skycons({ color: skyconColor }));
      smallSkycons[i].add(showIcons[i], icon);
      smallSkycons[i].play();
    }
    else {
      smallSkycons[i].set(showIcons, skyconColor, icon);
    }

    showPrecip[i].textContent = precipitation[i].chance ? precipitation[i].chance + '%' + '\n' + precipitation[i].type : '';
  }
}

/**
 * Change the color of the week forecast skycons
 * @param {string} color The color for the skycons
 */
function changeSkyconColors(color) {
  for (const i of smallSkycons) {
    i.set(showIcons[i], color);
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

  const lineWidth = smallDim * 0.1375; // seems to be about the right proportion
  ctx.lineWidth = lineWidth;
  const radius = smallDim / 2 - lineWidth / 2; // largest radius that will fit
  const mid = smallDim / 2; // get the midpoint of the smallest dimension - might be off-center but it should fit

  // *4 'cause it's going from 0 to .5 and not 0 to 1
  const calcMidPoint = (mid + radius) - (moonPhase % .5) * radius * 4;
  const otherArc = circleFromPoints(mid, mid - radius, mid, mid + radius, calcMidPoint, mid);

  const PI = Math.PI;
  // the y coordinates of the center points are the same, so opposite is the moon radius, 
  // and hypotenuse is the otherArc radius
  // and we can use the same angle because the moon is symmetrical across the horizontal axis
  const endpointAngle = Math.asin(radius / otherArc.r);

  ctx.beginPath();
  if ((moonPhase < .25 && moonPhase > 0) || (moonPhase > .5 && moonPhase < .75)) { // right-side curve )
    ctx.arc(otherArc.x, otherArc.y, otherArc.r, 2 * PI - endpointAngle, endpointAngle);
  }
  else if ((moonPhase > .25 && moonPhase < .5) || (moonPhase > .75 && moonPhase < 1)) { // left-side curve (
    ctx.arc(otherArc.x, otherArc.y, otherArc.r, PI + endpointAngle, PI - endpointAngle, true);
  }
  else if (moonPhase === .25 || moonPhase === .75) { // straight line for half moons
    ctx.moveTo(mid, mid - radius);
    ctx.lineTo(mid, mid + radius);
  }
  ctx.stroke();

  ctx.beginPath();
  if (moonPhase < 0.5 && moonPhase > 0) { // regular right half
    ctx.arc(mid, mid, radius, 1.5 * PI, .5 * PI);
  }
  else if (moonPhase > 0.5) { // regular left half
    ctx.arc(mid, mid, radius, .5 * PI, 1.5 * PI);
  }
  else { // whole and new moons
    ctx.arc(mid, mid, radius, 0, 2 * PI);
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

/**
 * Display any weather alerts
 * @param {*} alerts 
 */
function showAlerts(alerts) {
  if (alerts?.length) {
    const showAlerts = weather.querySelector('.alerts');
    showAlerts.innerHTML = '';
    for (const alert of alerts) {
      if (alerts.indexOf(alert) !== 0) {
        const divider = document.createElement('span');
        divider.classList.add('alertDivider');
        showAlerts.appendChild(divider);
      }
      const newAlert = document.createElement('a');
      newAlert.classList.add('alert');
      newAlert.textContent = `${alert.properties.event}`;
      newAlert.title = alert.properties.description;
      // TODO get alert URLs
      newAlert.href = alert.uri;
      showAlerts.appendChild(newAlert);
    }
  }
}

window.addEventListener('focus', () => {
  if (updateWeatherWhenNextActive) {
    getWeather();
    updateWeatherWhenNextActive = false;
  }
}, false);
