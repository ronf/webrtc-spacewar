/*
 * Copyright (c) 2020 by Ron Frederick <ronf@timeheart.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

'use strict'

/* global RTCPeerConnection */

import WebSocketRelay from './ws-relay.js'

class RTCPeer {
  constructor (relay, id, rtcConfig) {
    this.id = id
    this.relay = relay

    try {
      this.peerConn = new RTCPeerConnection(rtcConfig)
    } catch (e) {
      this.peerConn = null
      this.dataChannel = null
      return
    }

    this.peerConn.onicegatheringstatechange = event => {
      if (this.peerConn.iceGatheringState === 'complete') {
        const desc = this.peerConn.localDescription
        relay.wsSend(`${desc.type} ${desc.sdp}`, id)
      }
    }

    this.dataChannel = this.peerConn.createDataChannel(
      'relay', { negotiated: true, id: 0 })

    this.dataChannel.onopen = event => relay.recv(id, 'join')

    this.dataChannel.onmessage = event => {
      const [msgtype] = event.data.split(' ', 1)
      const message = event.data.substring(msgtype.length + 1)

      relay.recv(id, msgtype, message)
    }
  }

  async sendOffer () {
    const offer = await this.peerConn.createOffer()
    await this.peerConn.setLocalDescription(offer)
  }

  async recvOffer (sdp) {
    if (this.peerConn) {
      await this.peerConn.setRemoteDescription({ type: 'offer', sdp: sdp })
      await this.sendAnswer()
    }
  }

  async sendAnswer () {
    const answer = await this.peerConn.createAnswer()
    await this.peerConn.setLocalDescription(answer)
  }

  async recvAnswer (sdp) {
    await this.peerConn.setRemoteDescription({ type: 'answer', sdp: sdp })
  }

  relayType () {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      return 'WebRTC'
    } else {
      return 'WebSocket'
    }
  }

  send (message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message)
    } else {
      this.relay.wsSend(message, this.id)
    }
  }
}

export default class WebRTCRelay {
  constructor (url, rtcConfig) {
    this.myId = null
    this.peers = new Map()
    this.wsRelay = new WebSocketRelay(url)
    this.wsSend = this.wsRelay.send.bind(this.wsRelay)

    this.wsRelay.onself = id => {
      this.myId = id
      this.recv(id, 'self')
    }

    this.wsRelay.onjoin = async id => {
      const peer = new RTCPeer(this, id, rtcConfig)

      this.peers.set(id, peer)

      if (this.myId < id) await peer.sendOffer()
    }

    this.wsRelay.onquit = async id => {
      this.peers.delete(id)
      this.recv(id, 'quit')
    }

    this.wsRelay.onoffer = async (id, sdp) => {
      await this.peers.get(id).recvOffer(sdp)
    }

    this.wsRelay.onanswer = async (id, sdp) => {
      await this.peers.get(id).recvAnswer(sdp)
    }

    // Fall back to WebSocket messages if WebRTC setup fails
    this.wsRelay.onrecv = this.recv.bind(this)
  }

  relayType (target) {
    const peer = this.peers.get(target)

    return peer ? peer.relayType() : ''
  }

  send (message, target = '*') {
    if (target === '*') {
      this.peers.forEach(peer => peer.send(message))
    } else {
      const peer = this.peers.get(target)

      if (peer) peer.send(message)
    }
  }

  recv (source, msgtype, message) {
    const action = this[`on${msgtype}`]

    if (action) action(source, message)
  }
}
