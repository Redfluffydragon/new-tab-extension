import { TodoistApi } from "@doist/todoist-api-typescript";
import config from "../config.js";
import storage from "./storage.js";

const token = config.todoistKey;

const api = new TodoistApi(token);

let filter = '#Inbox';

const display = document.getElementById('todoistList');
const todoProjects = document.getElementById('todoProjects');
const todoistMenu = document.getElementById('todoistMenu');

const monthAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const todoistOptions = {
  filter: '#Inbox',
}

storage.get('todoistOptions').then(r => {
  todoistOptions.filter = r.todoistOptions.filter;
  refreshTasks(todoistOptions.filter);
});

function getDateString(date) {
  return monthAbbrev[date.getMonth()] + ' ' + date.getDate();
}

// Markdown rules
const rules = [
  //header rules
  [/#{6}\s?([^\n]+)/g, "<h6>$1</h6>"],
  [/#{5}\s?([^\n]+)/g, "<h5>$1</h5>"],
  [/#{4}\s?([^\n]+)/g, "<h4>$1</h4>"],
  [/#{3}\s?([^\n]+)/g, "<h3>$1</h3>"],
  [/#{2}\s?([^\n]+)/g, "<h2>$1</h2>"],
  [/#{1}\s?([^\n]+)/g, "<h1>$1</h1>"],

  //bold, italics and paragragh rules
  [/\*\*\s?([^\n]+)\*\*/g, "<b>$1</b>"],
  [/\*\s?([^\n]+)\*/g, "<i>$1</i>"],
  [/__([^_]+)__/g, "<b>$1</b>"],
  [/_([^_`]+)_/g, "<i>$1</i>"],
  // [/([^\n]+\n?)/g, "<p>$1</p>"], // don't wrap in p since everything is a list item

  //links
  [
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  ],

  //highlights
  [
    /(`)(\s?[^\n,]+\s?)(`)/g,
    '<a style="background-color:grey;color:black;text-decoration: none;border-radius: 3px;padding:0 2px;">$2</a>',
  ],

  //Lists
  [/([^\n]+)(\+)([^\n]+)/g, "<ul><li>$3</li></ul>"],
  [/([^\n]+)(\*)([^\n]+)/g, "<ul><li>$3</li></ul>"],

  //Image
  [
    /!\[([^\]]+)\]\(([^)]+)\s"([^")]+)"\)/g,
    '<img src="$2" alt="$1" title="$3" />',
  ],
];

async function showProjects() {
  const projects = await api.getProjects();
  for (const project of projects) {
    const option = document.createElement('option');
    option.value = '#' + project.name;
    option.textContent = project.name;
    todoProjects.append(option);
  }
  const option = document.createElement('option');
  option.value = 'today';
  option.textContent = 'Today';
  todoProjects.append(option);
  todoProjects.value = todoistOptions.filter;
}

// must be ordered in closest date to furthest
const specialDates = {
  today: {
    class: 'dueToday',
    name: 'Today',
    replaceString: () => getDateString(new Date()),
    date: () => {
      const endOfDay = new Date();
      endOfDay.setDate(endOfDay.getDate() + 1);
      endOfDay.setHours(0, 0, 0);
      return endOfDay;
    },
  },
  tomorrow: {
    class: 'dueTomorrow',
    name: 'Tomorrow',
    replaceString: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return getDateString(tomorrow);
    },
    date: () => {
      const endOfTomorrow = new Date();
      endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);
      endOfTomorrow.setHours(0, 0, 0);
      return endOfTomorrow;
    },
  },
}

function getDueDate(task, type = 'date') {
  if (!task.due) {
    // Return Infinity if no due date so they get sorted to the bottom
    return type === 'date' ? Infinity : '';
  }
  let date;
  if (task.due.datetime) {
    date = new Date(task.due.datetime);
  }
  else {
    const splitDate = task.due.date.split('-');
    // set to end of day if there isn't a time specified
    date = new Date(splitDate[0], splitDate[1] - 1, splitDate[2], 23, 59, 59);
  }

  if (type === 'date') {
    return date;
  }
  else if (type === 'string') {
    if (task.due.datetime) {
      // TODO add AM and PM
      return `${getDateString(date)} ${date.getHours()}:${('0' + date.getMinutes()).slice(-2)}`;
    }
    else {
      return getDateString(date);
    }
  }
}

function remove(string, regex) {
  return string.replace(regex, '').replaceAll('  ', ' ').trim();
}

async function getTasks({ filter }) {
  try {
    const request = await fetch(`${config.corsSource}https://api.todoist.com/rest/v2/tasks?filter=${encodeURIComponent(filter)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });

    if (request.ok) {
      return await request.json();
    }
    return [];
  }
  catch {
    return await api.getTasks({ filter });
  }
}

async function refreshTasks(filter = '#Inbox') {
  const tasks = (await api.getTasks({ filter })).sort((a, b) => a.order - b.order).sort((a, b) => getDueDate(a) - getDueDate(b));
  display.innerHTML = '';

  // sort all tasks with a parent id to the bottom so the parent task exists by the time the child task is being rendered
  for (const task of tasks.sort((a, b) => typeof a.parentId === typeof b.parentId ? 0 : a.parentId === null ? -1 : 1)) {
    const li = document.getElementById('checklistTemplate').content.cloneNode(true);

    let content = task.content;
    rules.forEach(([rule, template]) => {
      content = content.replace(rule, template)
    });
    li.querySelector('.content').innerHTML = content;

    li.querySelector('input').value = task.id;

    li.querySelector('ul').id = `sub-list-${task.id}`;

    let dueString = getDueDate(task, 'string');

    const showDueDate = li.querySelector('.dueDate');

    if (task.due) {
      let isSpecialDate = false;

      const dueDate = getDueDate(task);

      if (task.due.isRecurring) {
        showDueDate.classList.add('recurring');
      }

      if (dueDate < new Date()) {
        showDueDate.classList.add('overdue');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        dueString = dueString.replace(getDateString(yesterday), 'Yesterday');
      }

      for (const date in specialDates) {
        const checkDate = specialDates[date];

        if (dueDate < checkDate.date()) {
          showDueDate.classList.add(checkDate.class);
          isSpecialDate = true;
          dueString = task.due.isRecurring ?
            checkDate.name :
            dueString.replace(checkDate.replaceString(), checkDate.name);
          break;
        }
      }

      if (!isSpecialDate) {
        let oneWeek = new Date();
        oneWeek.setDate(oneWeek.getDate() + 7);
        oneWeek.setHours(0, 0, 0);

        if (dueDate < oneWeek) {
          dueString = dueString.replace(getDateString(dueDate), daysOfWeek[dueDate.getDay()]);
          showDueDate.classList.add('dueInNextWeek');
        }
      }
    }

    showDueDate.querySelector('.dueString').innerText = dueString;

    if (!task.parentId) {
      display.append(li);
    }
    else {
      document.getElementById(`sub-list-${task.parentId}`).append(li);
    }
  }
}

showProjects();

document.forms.todoistForm.addEventListener('input', e => {
  if (e.target.checked) {
    api.closeTask(e.target.value).then(() => {
      refreshTasks(todoistOptions.filter);
    });
  }
  else {
    api.reopenTask(e.target.value).then(() => {
      refreshTasks(todoistOptions.filter);
    });
  }
}, false);

document.forms.todoistForm.addEventListener('submit', e => {
  e.preventDefault();
}, false);

document.addEventListener('contextmenu', e => {
  document.querySelectorAll('#todoistList li').forEach(el => el.classList.remove('highlight_task'));

  const li = e.target.closest('#todoistList li');
  if (li) {
    e.preventDefault();
    li.classList.add('highlight_task');
    todoistMenu.classList.remove('none');
    todoistMenu.style.left = e.layerX + 'px';
    todoistMenu.style.top = e.layerY + 'px';
    const currentID = li.querySelector('input').value;
    const currentName = li.querySelector('.content').innerText;

    document.addEventListener('click', e => {
      if (e.target.matches('#deleteTask') && confirm('Are you sure you want to delete ' + currentName + '?')) {
        api.deleteTask(currentID).then(() => {
          refreshTasks(todoistOptions.filter);
        }).catch(err => {
          alert(`Error deleting task: ${err}`);
        });
      }
      else if (e.target.matches('#editTask')) {
        location.href = `https://todoist.com/showTask?id=${currentID}`;
      }

      li.classList.remove('highlight_task');
      todoistMenu.classList.add('none');
    }, { once: true });

    document.addEventListener('contextmenu', () => {

    }, { once: true });
  }
  else if (!e.target.closest('.menu')) {
    document.querySelectorAll('#todoistList li').forEach(el => el.classList.remove('highlight_task'));
    todoistMenu.classList.add('none');
  }
}, false);

todoistMenu.addEventListener('contextmenu', e => {
  e.preventDefault();
}, false);

document.forms.newTask.addEventListener('submit', e => {
  e.preventDefault();
  const name = new FormData(document.forms.newTask).get('name');

  let dueString;
  let content = name;

  // TODO add "in X days/weeks/months etc"
  // TODO add simply "at <time>"
  const parseDue = name.match(/(today|tomorrow|every day|((every )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)))( at \d(:\d\d)? ?(pm|am)?)?$/i)?.[0];
  if (parseDue) {
    dueString = parseDue[0].toUpperCase() + parseDue.slice(1);
    content = remove(content, new RegExp(parseDue, 'i'));
  }

  if (name) {
    document.forms.newTask.querySelector('fieldset').toggleAttribute('disabled', true);
    // TODO make it add to the currently displayed project
    api.addTask({
      content,
      dueString,
    })
      .then(() => {
        refreshTasks(todoistOptions.filter);
        document.forms.newTask.reset();
      })
      .catch(err => {
        alert(`Error adding task: ${err}`);
      })
      .finally(() => {
        document.forms.newTask.querySelector('fieldset').toggleAttribute('disabled', false);
      });
  }
}, false);

// Switch displayed project
todoProjects.addEventListener('input', () => {
  // TODO change the link (https://todoist.com/app/project/{project_id})
  refreshTasks(todoProjects.value);
  todoistOptions.filter = todoProjects.value;
  storage.set({ todoistOptions });
}, false);
