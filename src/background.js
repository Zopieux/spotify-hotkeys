function sendCommandToTab(command, tab) {
  // Some buttons have a convenient CSS class/attribute. Use that to find it and click.
  function usingSelector(command) {
    const spoticon = x => `.control-button.spoticon-${x}-16`;
    const testid = x => `[data-testid=${x}]`;
    const selectors = {
      'play-pause': [spoticon('play'), spoticon('pause'), testid('control-button-play'), testid('control-button-pause')],
      'next': [spoticon('skip-forward'), testid('control-button-skip-forward')],
      'previous': [spoticon('skip-back')],
      'shuffle': [spoticon('shuffle')],
      'repeat': [spoticon('repeat'), spoticon('repeatonce')],
      'like': ['.control-button-heart button'],
    }[command];
    if (!selectors) return null;
    const selector = selectors.join(', ');
    return `
      (function () {
        const e = document.querySelector("${selector}");
        if (!e) throw "";
        e.click();
      })`;
  }

  // A Very Cursed search for a specific iconography using CSS <path> d=
  // attribute. Then go up the DOM tree to find the parent button and click.
  function usingSvg(command) {
    const paths = {
      'play-pause': ['M0 0h16v16H0z', 'M4.018 14L14.41 8 4.018 2z'],
      'next': ['M11 3v4.119L3 2.5v11l8-4.619V13h2V3z'],
      'previous': ['M13 2.5L5 7.119V3H3v10h2V8.881l8 4.619z'],
      'shuffle': ['M4.5 6.8l.7-.8C4.1 4.7 2.5 4 .9 4v1c1.3 0 2.6.6 3.5 1.6l.1.2zm7.5 4.7c-1.2 0-2.3-.5-3.2-1.3l-.6.8c1 1 2.4 1.5 3.8 1.5V14l3.5-2-3.5-2v1.5zm0-6V7l3.5-2L12 3v1.5c-1.6 0-3.2.7-4.2 2l-3.4 3.9c-.9 1-2.2 1.6-3.5 1.6v1c1.6 0 3.2-.7 4.2-2l3.4-3.9c.9-1 2.2-1.6 3.5-1.6z'],
      'like': ['M13.764 2.727a4.057 4.057 0 00-5.488-.253.558.558 0 01-.31.112.531.531 0 01-.311-.112 4.054 4.054 0 00-5.487.253A4.05 4.05 0 00.974 5.61c0 1.089.424 2.113 1.168 2.855l4.462 5.223a1.791 1.791 0 002.726 0l4.435-5.195A4.052 4.052 0 0014.96 5.61a4.057 4.057 0 00-1.196-2.883zm-.722 5.098L8.58 13.048c-.307.36-.921.36-1.228 0L2.864 7.797a3.072 3.072 0 01-.905-2.187c0-.826.321-1.603.905-2.187a3.091 3.091 0 012.191-.913 3.05 3.05 0 011.957.709c.041.036.408.351.954.351.531 0 .906-.31.94-.34a3.075 3.075 0 014.161.192 3.1 3.1 0 01-.025 4.403z'],
      'repeat': [
        'M5.5 5H10v1.5l3.5-2-3.5-2V4H5.5C3 4 1 6 1 8.5c0 .6.1 1.2.4 1.8l.9-.5C2.1 9.4 2 9 2 8.5 2 6.6 3.6 5 5.5 5zm9.1 1.7l-.9.5c.2.4.3.8.3 1.3 0 1.9-1.6 3.5-3.5 3.5H6v-1.5l-3.5 2 3.5 2V13h4.5C13 13 15 11 15 8.5c0-.6-.1-1.2-.4-1.8z',
        'M5 5v-.5V4c-2.2.3-4 2.2-4 4.5 0 .6.1 1.2.4 1.8l.9-.5C2.1 9.4 2 9 2 8.5 2 6.7 3.3 5.3 5 5zM10.5 12H6v-1.5l-3.5 2 3.5 2V13h4.5c1.9 0 3.5-1.2 4.2-2.8-.5.3-1 .5-1.5.6-.7.7-1.6 1.2-2.7 1.2zM11.5 0C9 0 7 2 7 4.5S9 9 11.5 9 16 7 16 4.5 14 0 11.5 0zm.9 7h-1.3V3.6H10v-1h.1c.2 0 .3 0 .4-.1.1 0 .3-.1.4-.2.1-.1.2-.2.2-.3.1-.1.1-.2.1-.3v-.1h1.1V7z'
      ],
    }[command];
    if (!paths) return null;
    const sel = paths.map(p => `.player-controls path[d="${p}"]`).join(', ');
    return `
      (function () {
        let e = document.querySelector('${sel}');
        if (!e) throw "";
        while (e && e.tagName.toLowerCase() !== "button") e = e.parentNode;
        if (!e) throw "";
        e.click();
      })`;
  }

  // Let's have multiple methods to find the right button, because Spotify
  // decided front-end development was more exciting with randomized CSS
  // classes... but not for all UI elements of course. Yay, consistency!
  const codes = [usingSelector, usingSvg].map(e => e.call(this, command)).filter(e => !!e);

  // No method available for that command. Bail out.
  if (!codes.length) {
    console.error(`nothing to do for ${command}`);
    return;
  }

  // Use some reduce() smartness to use each method one after the other.
  // Each method shoud throw to communicate that it failed to click its button.
  // Use 'return;' to stop at the first successful method.
  const tryCascade = codes.reverse().reduce(
    (acc, fun) => `try { ${fun}(); return; } catch (_) { ${acc} }`,
    '');
  // Wrap inside a function to allow for the early 'return;' above.
  const code = `(function () { ${tryCascade} })();`;
  chrome.tabs.executeScript(tab.id, { code });
}

chrome.commands.onCommand.addListener(function (command) {
  chrome.tabs.query({ url: 'https://open.spotify.com/*' }, function (tabs) {
    tabs.forEach(tab => sendCommandToTab(command, tab));
  });
});
