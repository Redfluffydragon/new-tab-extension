# New Tab Extension - All the Links
A new tab with all the links you want.

I had to copy this over from the original project because I had committed stuff like the Dark Sky API key and other info that should be private.

You might notice that the weather won't work. This is because, as above, I did not include the Dark Sky API key, for obvious reasons. Also, to make requests work with CORS on my personal computer, I set up a CORS-everywhere server ([this one](https://github.com/Rob--W/cors-anywhere/)) running on localhost. This source code does not include any of that either.

## Features

### Links
I started making this because I wanted to be able to add a bunch of links to my new tab page, so that's the main feature. Once you add a link, you can drag and drop it anywhere, or have it locked to rows for prettier alignment. Just don't change your window size, because I used absolute posiitoning for the links. You can edit, delete, and reset the links. (Reset in this case refers to putting links back in the starting div)

The favicons are mostly gotten with Google's favicon finder (I know it's not really meant for this, but if I'm the only one using it I figured it would be fine). Perhaps ironically, it doesn't work for Google services like docs, Gmail, etc. so I hardcoded those in.

### Weather
As I mentioned before, I used the Dark Sky API for weather. I used Skycons for the weather icons, and I made the moon phase icon and temperature display. In options, you can have it set dark mode automatically based on the current weather conditions.

### Notes

The notes feature is just a textarea with some very basic features added with Rexeg. It can do automatic bullet list continuation, tab to indent, and Ctrl+Shift+K to delete a line. (I'm used to VSCode shortcuts)

### Sync

This uses the Chrome Storage API to sync all link, notes, and options data between tabs/windows/devices with the same Chrome account.

### Chrome links

I added links to settings, bookmarks, history, etc because I often use my laptop in tablet mode (360 degree hinge) and it's very convenient to have those right there to tap on.
