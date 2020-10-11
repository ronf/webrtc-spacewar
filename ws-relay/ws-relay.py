#!/usr/bin/env python3.8
#
# Copyright (c) 2020 by Ron Frederick <ronf@timeheart.net>
#
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the "Software"),
# to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Software, and to permit persons to whom the
# Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included
# in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
# THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.
#
# SPDX-License-Identifier: MIT

import asyncio
import websockets


class WSRelay:
    _relays = {}

    def __init__(self):
        self._sockets = {}
        self._next_id = 1

    async def _send(self, source, target, message):
        """Send a message on one or more associated WebSockets"""

        message = f'{source} {message}'

        if target == '*':
            await asyncio.gather(*(sock.send(message) for (target, sock) in
                                   self._sockets.items() if target != source))
        else:
            try:
                await self._sockets[target].send(message)
            except KeyError:
                pass

    async def _recv(self, sock, path):
        """Receive and relay messages on a WebSocket"""

        source = str(self._next_id)
        self._next_id += 1

        await sock.send(f'{source} self')

        for peer in self._sockets.keys():
            await sock.send(f'{peer} join')

        await self._send(source, '*', 'join')
        self._sockets[source] = sock

        try:
            async for message in sock:
                target, message = message.split(None, 1)
                await self._send(source, target, message)
        except websockets.WebSocketException:
            pass
        finally:
            del self._sockets[source]
            await self._send(source, '*', 'quit')

            if not self._sockets:
                del self._relays[path]

    @classmethod
    async def _accept(cls, sock, path):
        """Accept a new WebSocket connection"""

        try:
            relay = cls._relays[path]
        except KeyError:
            relay = cls()
            cls._relays[path] = relay

        await relay._recv(sock, path)

    @classmethod
    def listen(cls, host, port):
        """Set up a listener for WebSocket connections"""

        return websockets.serve(cls._accept, host, port)


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(WSRelay.listen('localhost', 7927))
    loop.run_forever()
