WebRTC Spacewar Installation Guide
==================================

Installing the main files
-------------------------

As a prerequisite, you'll need an HTTPS-capable web server to host
Spacewar on. The details of getting that set up are beyond the scope
of this document, but can be readily found on the web.

Once you have a web server set up and HTTPS configured on it, you need
to create a directory to hold the Spacewar game and then copy the
following files from the `spacewar` directory in this distribution
to there:

  * spacewar.html
  * spacewar.css
  * spacewar.js
  * webrtc-relay.js
  * ws-relay.js

You can optionally make a link from index.html to spacewar.html if
you want to be able to launch the game by just specifying the directory
path.

Setting up your ICE servers
---------------------------

In addition to the above files, you'll need to add a file named ice.js
in this same directory. This file specifies the STUN or TURN servers you
want to use when setting up WebRTC. There are example files in the top
level directory of this distribution named ice-stun-example.js and 
ice-turn-example.js that you can use to see the syntax required. If
you don't want to set up your own servers, there are public STUN servers
you can use - just Google for "public stun servers" to get a current list
and fill in one of those hostnames in place of "stun.example.org" in
the ice-stun-example.js file, save that under the name ice.js, and copy
it into the directory with the other spacewar files.

If you need a TURN server, you'll probably need to set that up yourself. A
good choice for this is an open-source STUN/TURN server named `coturn`__.

__ https://github.com/coturn/coturn

Setting up the WebSocket relay
------------------------------

To allow game clients to find one another, I built a very simple "relay"
in Python which acts as a WebSocket server. It runs as a separate process
listening on a localhost port for plain HTTP, intended to receive HTTPS
requests forwarded from the main web server on the host after they are
decrypted.

To install this WebSocket relay, you need to do the following:

  1. Copy the file ws-relay/ws-relay.py to wherever you keep daemons
     you want to run at boot and change the permissions to make it
     executable. In my case, I copied this file to the /opt/local/libexec
     directory.

  2. If necessary, edit the initial line in this file to make sure it
     is referring to a version of Python you have installed on the
     system. By default,it looks for "python3.8". Also, make sure you
     have installed the "websockets" package in the version of Python
     you select here.

  3. Configure your OS to start this script automatically on every
     boot. On macOS, I did this using a plist file placed in the
     /Library/LaunchDaemons directory. On Linux, this would typically
     be done by creating a new systemd service.

  4. Set up your web server where you are hosting Spacewar to act as a
     reverse proxy, forwarding requests going to the path "/ws-relay"
     to this new WebSocket server. I use Caddy as my web server, and
     this can be done with a single line of additional configuration:

         reverse_proxy /ws-relay/* localhost:7927

     The "7927" here is the port number that `ws-relay.py`__ is configured
     to listen on by default.

     __ spacewar/ws-relay.py

  5. To test the new setup, you can use the Python websocket command
     line client by running:

        python -m websockets wss://yourserver.example.com/ws-relay/test

     If things are working, this should respond back with something like:

        < 1 self

     If you run a second instance of the above command in another shell,
     you should see the following in the first window:

        < 2 join

     The second window should show:

        < 2 self
        < 1 join

If all has gone well, you should now be able to access the spacewar.html
URL (or the directory URL if you have linked index.html to that) via HTTPS
on your web server from step 1 and the game should start!
