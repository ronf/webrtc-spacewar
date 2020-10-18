/*
 * Copyright (c) 2020 by Ron Frederick <ronf@timeheart.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:

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

const HIST_TIME = 60000
const HIST_LEN = 10

class ValueHistory extends Array {
  expire (now) {
    let n = 0

    this.forEach((elem, i) => {
      if (elem.time >= now - HIST_TIME) {
        if (i !== n) {
          this[n] = elem
        }

        n++
      }
    })

    this.splice(n)
  }

  sort () {
    return super.sort((a, b) => a.value > b.value)
  }
}

class LowValueHistory extends ValueHistory {
  insert (value, now) {
    this.expire(now)

    if (this.length < HIST_LEN || value < this[HIST_LEN - 1].value) {
      this.push({ value: value, time: now })
      this.sort().splice(HIST_LEN)
    }
  }
}

class HighValueHistory extends ValueHistory {
  insert (value, now) {
    this.expire(now)

    if (this.length < HIST_LEN || value > this[0].value) {
      this.push({ value: value, time: now })
      this.sort().splice(0, this.length - HIST_LEN)
    }
  }
}

export default class TimingStats {
  constructor () {
    this.low = new LowValueHistory()
    this.high = new HighValueHistory()
    this.avg = 0
    this.last = undefined
  }

  insert (value, now) {
    this.low.insert(value, now)
    this.high.insert(value, now)

    if (this.last === undefined) {
      this.avg = value
    } else {
      const delta = now - this.last

      this.avg = ((HIST_TIME - delta) * this.avg + delta * value) / HIST_TIME
    }

    this.last = now
  }

  stats () {
    const min = this.low.length !== 0 ? this.low[0].value : 0
    const max = this.high.length !== 0 ? this.high.slice(-1)[0].value : 0
    return [min, Math.round(this.avg), max]
  }
}
