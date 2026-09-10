// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 SASANO Takayoshi <uaa@uaa.org.uk>

export class HIDDevice {
    lastState = 0;
    lastKey = 0;
    lastTime = 0;
    isFirstPress = true;
    kind = "";
    queue = null;
    keydownHandler = null;
    keyupHandler = null;
    mousedownHandler = null;
    mouseupHandler = null;

    constructor(eventQueue) {
	this.queue = eventQueue;
    }

    process_press(kind) {
	const currentTime = performance.now();
	if (!this.isFirstPress && !event.repeat && !this.lastState) {
	    this.queue.push({
		state: this.lastState,
		elapsed_time_ms: currentTime - this.lastTime
	    });
	}
	if (!event.repeat && !this.lastState) {
	    this.lastState = 1;
	    this.lastKey = event.key
	    this.lastTime = currentTime;
	    this.kind = kind;
	    this.isFirstPress = false;
	}
    }

    process_release(kind) {
	const currentTime = performance.now();
	if (!this.isFirstPress && event.key == this.lastKey && kind == this.kind && this.lastState) {
	    this.queue.push({
		state: this.lastState,
		elapsed_time_ms: currentTime - this.lastTime
	    });
	    this.lastState = 0;
	    this.lastTime = currentTime;
	}
    }

    async open() {
	this.lastState = 0;
	this.isFirstPress = true;

	// event listener for key press
	this.keydownHandler = (event) => {
	    this.process_press("key");
	};

	// event listener for key release
	this.keyupHandler = (event) => {
	    this.process_release("key");
	};

	// event listener for mouse press
	this.mousedownHandler = (event) => {
	    this.process_press("mouse");
	};

	// event listener for mouse release
	this.mouseupHandler = (event) => {
	    this.process_release("mouse");
	};

	window.addEventListener('keydown', this.keydownHandler);
	window.addEventListener('keyup', this.keyupHandler);
	window.addEventListener('mousedown', this.mousedownHandler);
	window.addEventListener('mouseup', this.mouseupHandler);
    }

    async close() {
	if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
	if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
	if (this.mousedownHandler) window.removeEventListener('mousedown', this.mousedownHandler);
	if (this.mouseupHandler) window.removeEventListener('mouseup', this.mouseupHandler);
    }
}
