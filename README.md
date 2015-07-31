pi_livestreaming
================

[Raspberry Pi, Camera and Node.js – Live Streaming with Websockets #IoT original post](http://thejackalofjavascript.com/rpi-live-streaming)

Usage
------------
- Clone this project to RPI
- Run 'npm install' in the project foler
- Create a 'img' directory under 'public' folder; or link a Ramdisk(https://wiki.archlinux.org/index.php/Tmpfs) folder to public/img.
  The latter is recommended since that will reduce frequent write on your SD card.
- Optionally, create a 'config.json' in the project folder, including below content:
  {
      port: 3000;
      fakemode: false;
  }
- Recommend: use 'sueprvisord' to start/stop/monitor your node.js application
- Run 'node index.js', and use a browser to access: http://<RPI-address>:3000/

Enhancements
------------
- Add a 'nconf' module. This module will read config.json as a configuration file. Also a 'fakemode' added if you don't want others to watch you :)
- Use fs.watch() to replace fs.watchFile() for instant file change notification.
