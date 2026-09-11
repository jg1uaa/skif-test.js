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
    pointerdownHandler = null;
    pointerupHandler = null;

    constructor(eventQueue) {
        this.queue = eventQueue;
    }

    process_press(kind, key) {
        const currentTime = performance.now();
        if (!this.isFirstPress && !this.lastState) {
            this.queue.push({
                state: this.lastState,
                elapsed_time_ms: currentTime - this.lastTime
            });
        }
        if (!this.lastState) {
            this.lastState = 1;
            this.lastKey = key
            this.lastTime = currentTime;
            this.kind = kind;
            this.isFirstPress = false;
        }
    }

    process_release(kind, key) {
        const currentTime = performance.now();
        if (!this.isFirstPress && key == this.lastKey && kind == this.kind && this.lastState) {
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

        // disable pointer action
        document.body.style.userSelect = "none";
        document.body.style.webkitUserSelect = "none";
        document.body.style.touchAction = "none";

        // event listener for key press
        this.keydownHandler = (event) => {
            // autorepeat event is discarded here
            event.repeat || this.process_press("key", event.key);
        };

        // event listener for key release
        this.keyupHandler = (event) => {
            this.process_release("key", event.key);
        };

        // event listener for pointer press
        this.pointerdownHandler = (event) => {
            this.process_press("pointer", event.pointerId);
        };

        // event listener for pointer release
        this.pointerupHandler = (event) => {
            this.process_release("pointer", event.pointerId);
        };

        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);
        window.addEventListener('pointerdown', this.pointerdownHandler);
        window.addEventListener('pointerup', this.pointerupHandler);
    }

    async close() {
        // enable pointer action
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
        document.body.style.touchAction = "";

        if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
        if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler);
        if (this.pointerdownHandler) window.removeEventListener('pointerdown', this.pointerdownHandler);
        if (this.pointerupHandler) window.removeEventListener('pointerup', this.pointerupHandler);
    }
}
