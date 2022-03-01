chrome.commands.onCommand.addListener(command => {
  let currentTabId;
  chrome.tabs.query({active: true, currentWindow: true}, t => {
    currentTabId = t[0].id;
    currentTabIdx = t[0].index;
    if (command === 'move-to-first') {
      chrome.tabs.move(currentTabId, {index: 0});
    }
    else if (command === 'move-to-last') {
      chrome.tabs.move(currentTabId, {index: -1});
    }
    else if (command === 'move-to-left') {
      chrome.tabs.move(currentTabId, {index: currentTabIdx-1})
    }
    else if (command === 'move-to-right') {
      chrome.tabs.move(currentTabId, {index: currentTabIdx+1})
    }
  });
});