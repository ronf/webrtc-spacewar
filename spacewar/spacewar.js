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

/* global Path2D, location, localStorage, performance, requestAnimationFrame */
/* global canvas, configPane, nameField, timingPane, webRTCCheckbox */
/* global iceServerField, iceUsernameField, iceCredentialField */
/* global resetButton, cancelButton, okButton, timingTableBody */

import iceServers from './ice.js'
import TimingStats from './timing.js'
import WebRTCRelay from './webrtc-relay.js'
import WebSocketRelay from './ws-relay.js'

function spacewar () {
  const SUN_MASS = 4

  const MAX_MISSILES = 10

  const THRUST = 0.00004
  const ROTATION = 0.004

  const NAME_FONT = '12px Arial'

  const MIN_SCALE = 0.0625
  const MAX_SCALE = 4

  const DEFAULT_ORBIT = 350

  const FRAME_TIME = 1
  const KEEPALIVE_TIME = 1000
  const DESTROYED_TIME = 3000
  const HYPERSPACED_TIME = 3000
  const LAUNCH_TIME = 500
  const MISSILE_ARM_TIME = 250
  const MISSILE_LIFETIME = 5000

  const DEBRIS_XPOS = [-6, -6.1, 6, 6, -6.1, -6]
  const DEBRIS_YPOS = [2, 5.3, 0.7, -0.7, -5.3, -2]
  const DEBRIS_ANGLE = [0.648, 0.886, 0.886, 1.114, 1.114, 1.352]

  const defaultConfig = {
    name: '',
    useWebRTC: true,
    rtcConfig: { iceServers: iceServers }
  }

  const ShipStates = {
    ACTIVE: 'active',
    DESTROYED: 'destroyed',
    HYPERSPACED: 'hyperspaced'
  }

  class ShipShape {
    constructor (shipShape, thrustShape) {
      this.shipPath = new Path2D(shipShape)
      this.thrustPath = new Path2D(thrustShape)
    }
  }

  const shipShapes = [
    new ShipShape(
      'M -5,0 -8,6 8,0 -8,-6 Z',
      'M -5,0 -7,4 -12,0 -7,-4'),
    new ShipShape(
      'M -6,3 -8,5 4,5 8,0 4,-5 -8,-5 -6,-3 Z',
      'M -6,3 -6,-3 -7,-4 -12,0 -7,4'),
    new ShipShape(
      'M -5,0 -8,6 -4,6 1,2 6,2 8,0 6,-2 1,-2 -4,-6 -8,-6 Z',
      'M -5,0 -7,4 -12,0 -7,-4'),
    new ShipShape(
      'M -8,6 -3,2 6,2 8,0 6,-2 -3,-2 -8,-6 Z',
      'M -8,4 -8,-4 -12,0'),
    new ShipShape(
      `M -8,6 1,6 2,5 2,4 1,3 -2,3 -1,1 2,1 4,3 6,3 8,1 8,-1 6,-3 4,-3
       2,-1 -1,-1 -2,-3 1,-3 2,-4 2,-5 1,-6 -8,-6 -8,-3 -3,-3 -2,-1 -4,-1
       -5,0 -4,1 -2,1 -3,3 -8,3 Z`,
      'M -8,6 -12,5 -12,4 -8,3 -8,-3 -12,-4 -12,-5 -8,-6'),
    new ShipShape(
      `M 8,1 7,2 6,2 5,1 3,1 4,2 4,3 3,5 1,6 0,6 -1,5 -1,4 1,3 2,2 1,1 0,2
       -2,3 -4,2 -5,1 -6,2 -5,3 -3,4 -3,5 -4,6 -5,6 -7,5 -8,3 -8,2 -7,1
       -5,0 -7,-1 -8,-2 -8,-3 -7,-5 -5,-6 -4,-6 -3,-5 -3,-4 -5,-3 -6,-2
       -5,-1 -4,-2 -2,-3 0,-2 1,-1 2,-2 1,-3 -1,-4 -1,-5 0,-6 1,-6 3,-5
       4,-3 4,-2 3,-1 5,-1 6,-2 7,-2 8,-1 Z`,
      'M -5,0 -7,1 -9,1 -10,2 -11,2 -12,1 -12,-1 -11,-2 -10,-2 -9,-1 -7,-1'),
    new ShipShape(
      `M 8,0 6,2 5,4 4,5 2,6 -3,6 -6,5 -8,4 -3,3 -2,2 -1,0 -2,-2 -3,-3
       -8,-4 -6,-5 -3,-6 2,-6 4,-5 5,-4 6,-2 Z`,
      'M -1,0 -2,2 -12,0 -2,-2'),
    new ShipShape(
      `M 8,1 7,4 6,4 4,3 3,2 -2,1 0,2 1,3 1,4 0,5 -2,6 -4,6 -6,5 -7,4 -8,2
       -8,-2 -7,-4 -6,-5 -4,-6 -2,-6 0,-5 1,-4 1,-3 0,-2 -2,-1 3,-2 4,-3
       6,-4 7,-4 8,-1 Z`,
      'M -7,6 -10,4 -12,2 -12,-2 -10,-4 -7,-6 -9,-2 -9,2')
  ]

  /* eslint-disable one-var */
  var config, relay, ctx, sunPath, missilePath, debrisPath
  var origX = 0, origY = 0, scale = 1, trackedShip = null
  var zoomIn = false, zoomOut = false
  var rotateLeft = false, rotateRight = false, thrust = false, fire = false
  var observeOnly = false, paused = false, showNames = true
  var reportNeeded = true, lastTick = 0
  var myShip, ships = new Map()
  /* eslint-enable one-var */

  function initPaths () {
    sunPath = new Path2D()
    sunPath.arc(0, 0, 12, 0, 2 * Math.PI, true)

    missilePath = new Path2D()
    missilePath.arc(0, 0, 2.5, 0, 2 * Math.PI, true)

    debrisPath = new Path2D('M -4,0 4,0')
  }

  function drawScaled (x, y, angle, draw) {
    const objScale = Math.min(1 / (1 - Math.log(scale) / 1.5), MAX_SCALE)
    const scaleAdjust = objScale / scale

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.scale(scaleAdjust, scaleAdjust)
    draw()
    ctx.restore()
  }

  class Grav {
    constructor () {
      this.xpos = 0
      this.ypos = 0
      this.angle = 0
      this.xvel = 0
      this.yvel = 0
      this.angvel = 0
    }

    testHit (xpos, ypos, radius = 12) {
      return Math.sqrt((this.xpos - xpos) ** 2 +
                       (this.ypos - ypos) ** 2) <= radius
    }

    placeRandom () {
      const radius = (1 + Math.random() * 3) / 4 * DEFAULT_ORBIT
      const theta = 2 * Math.PI * Math.random()
      const angle = 2 * Math.PI * Math.random()
      const direction = (Math.random() >= 0.5) ? 1 : -1
      const vel = direction * Math.sqrt(4 / radius)

      this.xpos = radius * Math.cos(theta)
      this.ypos = radius * Math.sin(theta)
      this.angle = angle

      this.xvel = vel * Math.cos(theta - Math.PI / 2)
      this.yvel = vel * Math.sin(theta - Math.PI / 2)
      this.angvel = 0
    }

    update (frameTime, rotation = 0, thrust = 0) {
      let xacc = thrust * Math.cos(this.angle)
      let yacc = thrust * Math.sin(this.angle)

      const rCubed = (this.xpos ** 2 + this.ypos ** 2) ** 1.5

      if (rCubed !== 0) {
        xacc -= SUN_MASS * this.xpos / rCubed
        yacc -= SUN_MASS * this.ypos / rCubed
      }

      this.xvel += xacc * frameTime
      this.yvel += yacc * frameTime
      this.angvel += rotation * frameTime

      this.xpos += this.xvel * frameTime
      this.ypos += this.yvel * frameTime
      this.angle += this.angvel * frameTime
    }
  }

  class Missile {
    constructor (grav, lifetime = 1) {
      this.grav = grav
      this.lifetime = lifetime
    }

    checkCollision () {
      if (this.grav.testHit(0, 0, 24) || this.lifetime > MISSILE_LIFETIME) {
        return true
      }

      for (const ship of ships.values()) {
        if (ship.state === ShipStates.DESTROYED) {
          for (const debris of ship.debrisGrav) {
            if (this.grav.testHit(debris.xpos, debris.ypos)) {
              return true
            }
          }
        }

        for (const missile of ship.missiles) {
          if (missile === this) continue

          if (this.grav.testHit(missile.grav.xpos, missile.grav.ypos)) {
            ship.missiles.delete(missile)
            return true
          }
        }
      }
    }

    draw () {
      const grav = this.grav

      drawScaled(grav.xpos, grav.ypos, grav.angle, () => ctx.fill(missilePath))
    }

    update (frameTime) {
      this.grav.update(frameTime)
      this.lifetime += frameTime
    }
  }

  class Ship {
    constructor (id) {
      this.id = id
      this.name = ''
      this.state = ShipStates.HYPERSPACED
      this.shape = shipShapes[id % shipShapes.length]
      this.rotation = 0
      this.thrust = 0
      this.recvDelay = 0
      this.lastActive = 0
      this.lastUpdate = 0
      this.lastLaunch = 0
      this.lastReport = 0
      this.sendTiming = new TimingStats()
      this.recvTiming = new TimingStats()

      this.grav = new Grav()
      this.debrisGrav = [...Array(DEBRIS_XPOS.length)].map(() => new Grav())
      this.missiles = new Set()

      ships.set(id, this)
    }

    draw () {
      let grav = this.grav

      switch (this.state) {
        case ShipStates.ACTIVE:
          drawScaled(grav.xpos, grav.ypos, grav.angle, () => {
            ctx.lineWidth = 1 + 0.5 * (this === myShip)
            ctx.stroke(this.shape.shipPath)

            if (this.thrust) {
              ctx.fill(this.shape.thrustPath)
            }

            if (showNames) {
              ctx.rotate(-grav.angle)
              ctx.fillText(this.name, 0, 24)
            }
          })
          break
        case ShipStates.DESTROYED:
          for (grav of this.debrisGrav) {
            drawScaled(grav.xpos, grav.ypos, grav.angle,
              () => ctx.stroke(debrisPath))
          }
          break
        default:
          break
      }

      this.missiles.forEach(missile => missile.draw())
    }

    placeRandom (now) {
      this.state = ShipStates.ACTIVE
      this.lastLaunch = this.lastUpdate = now
      this.grav.placeRandom()
      reportNeeded = true
    }

    checkCollision () {
      if (this.state !== ShipStates.ACTIVE) {
        return false
      }

      if (this.grav.testHit(0, 0, 24)) {
        return true
      }

      for (const ship of ships.values()) {
        if (ship !== this) {
          switch (ship.state) {
            case ShipStates.ACTIVE:
              if (this.grav.testHit(ship.grav.xpos, ship.grav.ypos)) {
                return true
              }

              break
            case ShipStates.DESTROYED:
              for (const debris of ship.debrisGrav) {
                if (this.grav.testHit(debris.xpos, debris.ypos)) {
                  return true
                }
              }

              break
            default:
              break
          }
        }

        for (const missile of ship.missiles) {
          if (missile.lifetime >= MISSILE_ARM_TIME &&
              this.grav.testHit(missile.grav.xpos, missile.grav.ypos)) {
            return true
          }
        }
      }

      return false
    }

    destroy (now) {
      const grav = this.grav
      const cosang = Math.cos(grav.angle)
      const sinang = Math.sin(grav.angle)

      this.state = ShipStates.DESTROYED
      this.lastActive = now

      this.debrisGrav.forEach((debris, i) => {
        debris.xpos = grav.xpos + DEBRIS_XPOS[i] * cosang
        debris.ypos = grav.ypos + DEBRIS_YPOS[i] * sinang
        debris.angle = grav.angle + DEBRIS_ANGLE[i] * Math.PI

        debris.xvel = grav.xvel + Math.random() * 0.04 - 0.02
        debris.yvel = grav.yvel + Math.random() * 0.04 - 0.02
        debris.angvel = (Math.random() * 0.004 - 0.002) * Math.PI
      })

      reportNeeded = true
    }

    enterHyperspace (now) {
      if (this.state !== ShipStates.ACTIVE) return

      this.state = ShipStates.HYPERSPACED
      this.lastActive = now
      reportNeeded = true
    }

    launchMissile (now) {
      if (this.missiles.length === MAX_MISSILES) return

      const grav = new Grav()
      Object.assign(grav, this.grav)

      grav.xvel += 0.2 * Math.cos(this.grav.angle)
      grav.yvel += 0.2 * Math.sin(this.grav.angle)

      grav.angle = 0
      grav.angvel = 0

      this.missiles.add(new Missile(grav))
      this.lastLaunch = now
      reportNeeded = true
    }

    update (now) {
      let interval = now - this.lastUpdate

      while (interval > 0) {
        const frameTime = Math.min(interval, FRAME_TIME)
        interval -= frameTime

        switch (this.state) {
          case ShipStates.ACTIVE:
            this.grav.angvel = 0
            this.grav.update(frameTime, this.rotation, this.thrust)
            break
          case ShipStates.DESTROYED:
            this.debrisGrav.map(grav => grav.update(frameTime))
            break
          default:
            break
        }

        this.missiles.forEach(missile => missile.update(frameTime))
      }

      this.lastUpdate = now
    }

    reportTiming (table) {
      if (this === myShip) return

      const row = table.insertRow()
      const values = [this.name, relay.relayType(this.id)].concat(
        this.sendTiming.stats(), this.recvTiming.stats())

      values.forEach(value => {
        const cell = row.insertCell()
        cell.innerHTML = value
      })
    }
  }

  function fillConfigPane (newConfig) {
    nameField.value = newConfig.name
    webRTCCheckbox.checked = newConfig.useWebRTC

    const iceServer = newConfig.rtcConfig.iceServers[0]

    iceServerField.value = iceServer.urls[0]
    iceUsernameField.value = iceServer.username
    iceCredentialField.value = iceServer.credential
  }

  function loadConfig () {
    if (!localStorage.spacewar) {
      localStorage.spacewar = JSON.stringify(defaultConfig)
      configPane.style.display = 'flex'
    }

    config = JSON.parse(localStorage.spacewar)
    fillConfigPane(config)
  }

  function saveConfig () {
    config.name = nameField.value
    config.useWebRTC = webRTCCheckbox.checked

    const iceServer = config.rtcConfig.iceServers[0]

    iceServer.urls[0] = iceServerField.value
    iceServer.username = iceUsernameField.value
    iceServer.credential = iceCredentialField.value

    localStorage.spacewar = JSON.stringify(config)
  }

  function toggleConfig () {
    configPane.style.display = configPane.style.display ? null : 'flex'
  }

  function resetConfig () {
    fillConfigPane(defaultConfig)
  }

  function revertConfig () {
    fillConfigPane(config)
    configPane.style.display = null
    canvas.focus()
  }

  function applyConfig () {
    saveConfig()
    location.reload()
  }

  function toggleTiming () {
    timingPane.style.display = timingPane.style.display ? null : 'block'
  }

  function setSelf (id) {
    myShip = new Ship(id)

    const now = performance.now()
    myShip.placeRandom(now)
    lastTick = now
    requestAnimationFrame(tick)
  }

  function removeShip (id) {
    ships.delete(id)
  }

  function sendReport (now) {
    const offset = Date.now() - now
    const report = {
      name: myShip.name,
      state: myShip.state,
      rotation: myShip.rotation,
      thrust: myShip.thrust,
      lastUpdate: myShip.lastUpdate + offset,
      recvDelay: {}
    }

    switch (myShip.state) {
      case ShipStates.ACTIVE:
        report.grav = myShip.grav
        break
      case ShipStates.DESTROYED:
        report.debrisGrav = myShip.debrisGrav
        break
      default:
        break
    }

    ships.forEach(ship => {
      if (ship !== myShip) {
        report.recvDelay[ship.id] = ship.recvDelay
      }
    })

    report.missiles = Array.from(myShip.missiles)

    relay.send(`report ${JSON.stringify(report)}`)
    myShip.lastReport = now
    reportNeeded = false
  }

  function recvReport (id, message) {
    const now = performance.now()
    const report = JSON.parse(message)

    let ship = ships.get(id)

    if (ship === undefined) {
      ship = new Ship(id)
    }

    ship.name = report.name
    ship.state = report.state
    ship.rotation = report.rotation
    ship.thrust = report.thrust
    ship.recvDelay = Date.now() - report.lastUpdate
    ship.lastUpdate = now - ship.recvDelay
    ship.lastReport = now

    const sendDelay = report.recvDelay[myShip.id]
    if (sendDelay) ship.sendTiming.insert(sendDelay, now)

    ship.recvTiming.insert(ship.recvDelay, now)

    if (report.grav) Object.assign(ship.grav, report.grav)

    if (report.debrisGrav) {
      report.debrisGrav.forEach(
        (grav, i) => Object.assign(ship.debrisGrav[i], grav))
    }

    ship.missiles.clear()

    for (const missile of report.missiles) {
      const grav = new Grav()
      Object.assign(grav, missile.grav)
      ship.missiles.add(new Missile(grav, missile.lifetime))
    }
  }

  function keyDown (event) {
    if (event.repeat) return

    const now = performance.now()

    switch (event.key.toLowerCase()) {
      case 'a':
      case 'h':
      case 'arrowleft':
        rotateLeft = true
        reportNeeded = true
        break
      case 's':
      case 'j':
      case 'arrowright':
        rotateRight = true
        reportNeeded = true
        break
      case 'd':
      case 'k':
      case 'arrowup':
        thrust = true
        reportNeeded = true
        break
      case 'f':
      case 'l':
      case ' ':
        fire = true
        break
      case 'arrowdown':
      case 'enter':
        myShip.enterHyperspace(now)
        break
      case 'z':
        zoomIn = true
        break
      case 'x':
        zoomOut = true
        break
      case 'c':
        toggleConfig()
        break
      case 'r':
        origX = 0
        origY = 0
        scale = 1
        trackedShip = null
        break
      case 'n':
        showNames = !showNames
        break
      case 'o':
        observeOnly = !observeOnly

        if (observeOnly) {
          myShip.state = ShipStates.HYPERSPACED
          myShip.lastActive = 0
          myShip.missiles.clear()
        }

        break
      case 'p':
        paused = !paused

        if (!paused) {
          lastTick = now
          myShip.placeRandom(now)
          requestAnimationFrame(tick)
        }

        break
      case 't':
        toggleTiming()
        break
      default:
        break
    }
  }

  function keyUp (event) {
    switch (event.key.toLowerCase()) {
      case 'a':
      case 'h':
      case 'arrowleft':
        rotateLeft = false
        reportNeeded = true
        break
      case 's':
      case 'j':
      case 'arrowright':
        rotateRight = false
        reportNeeded = true
        break
      case 'd':
      case 'k':
      case 'arrowup':
        thrust = false
        reportNeeded = true
        break
      case 'f':
      case 'l':
      case ' ':
        fire = false
        break
      case 'z':
        zoomIn = false
        break
      case 'x':
        zoomOut = false
        break
      default:
        break
    }
  }

  function mouseClick (event) {
    if (event.button === 0) {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const xpos = origX + (x - canvas.width / 2) / scale
      const ypos = origY + (y - canvas.height / 2) / scale

      for (const ship of ships.values()) {
        if (ship.grav.testHit(xpos, ypos, 24)) {
          trackedShip = ship
          return
        }
      }

      origX = xpos
      origY = ypos
    }
  }

  function setupCanvas () {
    canvas.width = canvas.height =
      Math.min(window.innerWidth - 16, window.innerHeight - 64)
    canvas.focus()

    ctx = canvas.getContext('2d')
    ctx.strokeStyle = 'white'
    ctx.fillStyle = 'white'
    ctx.font = NAME_FONT
    ctx.textAlign = 'center'
  }

  function tick (now) {
    const interval = now - lastTick

    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (paused) return

    myShip.name = config.name
    myShip.rotation = (rotateRight - rotateLeft) * ROTATION
    myShip.thrust = thrust ? THRUST : 0

    if (myShip.checkCollision()) {
      myShip.destroy(now)
    }

    for (const ship of ships.values()) {
      if (ship !== myShip && now - ship.lastReport >= 5 * KEEPALIVE_TIME) {
        ships.delete(ship.id)
      }

      for (const missile of ship.missiles) {
        if (missile.checkCollision()) {
          ship.missiles.delete(missile)
        }
      }
    }

    ships.forEach(ship => ship.update(now))

    switch (myShip.state) {
      case ShipStates.ACTIVE:
        if (fire && now - myShip.lastLaunch >= LAUNCH_TIME) {
          myShip.launchMissile(now)
        }

        break
      case ShipStates.DESTROYED:
        if (now - myShip.lastActive >= DESTROYED_TIME) {
          myShip.placeRandom(now)
        }

        break
      case ShipStates.HYPERSPACED:
        if (!observeOnly && now - myShip.lastActive >= HYPERSPACED_TIME) {
          myShip.placeRandom(now)
        }

        break
    }

    if (reportNeeded || now - myShip.lastReport >= KEEPALIVE_TIME) {
      sendReport(now)
    }

    timingTableBody.innerHTML = ''
    ships.forEach(ship => ship.reportTiming(timingTableBody))

    if (trackedShip) {
      if (trackedShip.state === ShipStates.ACTIVE) {
        origX = trackedShip.grav.xpos
        origY = trackedShip.grav.ypos
      } else {
        trackedShip = null
      }
    }

    if (zoomIn !== zoomOut) {
      const zoom = (zoomIn - zoomOut) * interval / 1000
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * Math.exp(zoom)))
    }

    ctx.translate((canvas.width + 1) / 2, (canvas.height + 1) / 2)
    ctx.scale(scale, scale)
    ctx.translate(-origX, -origY)

    drawScaled(0, 0, 0, () => ctx.fill(sunPath))
    ships.forEach(ship => ship.draw())

    lastTick = now
    requestAnimationFrame(tick)
  }

  loadConfig()

  canvas.onkeydown = keyDown
  canvas.onkeyup = keyUp
  canvas.onclick = mouseClick

  resetButton.onclick = resetConfig
  cancelButton.onclick = revertConfig
  okButton.onclick = applyConfig

  window.onresize = setupCanvas

  if (config.useWebRTC) {
    relay = new WebRTCRelay(document.URL, config.rtcConfig)
  } else {
    relay = new WebSocketRelay(document.URL)
  }

  relay.onself = setSelf
  relay.onquit = removeShip
  relay.onreport = recvReport

  initPaths()
  setupCanvas()
}

window.onload = spacewar
