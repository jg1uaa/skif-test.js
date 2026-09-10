// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 SASANO Takayoshi <uaa@uaa.org.uk>

export class EventQueue {
    constructor() {
	this.queue = [];	// data queue
	this.resolvers = [];	// waiting list
    }

    push(event) {
	if (this.resolvers.length > 0) {
	    // pop side is idle: resolve immediately
	    const resolve = this.resolvers.shift();
	    resolve(event);
	} else {
	    // pop side is busy: enqueue
	    this.queue.push(event);
	}
    }

    pop() {
	if (this.queue.length > 0) {
	    // queue is not empty: resolve immediately
	    return Promise.resolve(this.queue.shift());
	} else {
	    // queue is empty: wait for push
	    return new Promise((resolve) => { this.resolvers.push(resolve); });
	}
    }
}
