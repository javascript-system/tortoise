//---------------------
// Tortoise.js - v1.0.0
//---------------------

(function (global) {
    let state = {
        initialized: false,
        paused: false,
        canvas: null,
        ctx: null,
        errCallback: null,
        loopId: null,
        lastFrameTime: 0,
        elementsList: [],
        configs: {
            fps: 60,
            maxFps: null,
            alwaysUseMaxFps: false,
            minFps: null,
            canvasElement: null,
            maxElementsOnScreen: Infinity,
            autoRemoveOutterElements: false,
            defaultFontFamily: 'sans-serif',
            forEachFrame: () => { },
            autoFrameClearing: true,
            setLibName: 'tortoise'
        }
    };

    let isInternalDraw = false;

    function throwErr(msg) {
        const errMsg = `TortoiseError: ${msg}`;
        if (state.errCallback) {
            state.errCallback(errMsg);
        } else {
            console.error(errMsg);
        }
        tortoise.kill();
        throw new Error(errMsg);
    }

    function checkInit() {
        if (!state.initialized) throwErr("Lib is not ready. Use tortoise.init().");
    }

    function applySecurity(ctx) {
        const drawingMethods = ['fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'lineTo', 'arc'];

        drawingMethods.forEach(method => {
            const originalMethod = ctx[method];
            ctx[method] = function (...args) {
                if (!isInternalDraw) {
                    throwErr(`Prevention of errors and security: Raw use of ctx.${method} on <canvas>.`);
                }
                return originalMethod.apply(this, args);
            };
        });
        return ctx;
    }

    class CanvasElement {
        constructor(id) {
            this.id = id;
            this.className = null;
            this.classIndex = null;
            this.events = { click: [], collision: [], deleted: [], styled: [], renamed: [] };

            this.style = {
                zIndex: 0, borderColor: '#000', borderWidth: 0, defaultMode: 'polygon',
                sides: 4, textContent: '', fontFamily: state.configs.defaultFontFamily,
                fontSize: 16, lineHeight: 1.2, borderOffset: 'center', opacity: 1,
                shadow: { color: 'transparent', blur: 0, x: 0, y: 0 },
                anchor: { x: 0.5, y: 0.5 }, src: null, href: null,
                rotation: 0, width: 50, height: 50, color: '#fff', x: 0, y: 0
            };
            this.imageObj = null;
        }

        editStyle(styles) {
            const editedKeys = Object.keys(styles);
            Object.assign(this.style, styles);
            if (styles.src || styles.href) {
                this.imageObj = new Image();
                this.imageObj.src = styles.href || styles.src;
            }
            this.triggerEvent('styled', { stylesEdited: editedKeys });
        }

        editId(newName) {
            const oldId = this.id;
            this.id = newName;
            tortoise.elements[newName] = this;
            delete tortoise.elements[oldId];
            this.triggerEvent('renamed', { newName: newName });
        }

        remove() {
            this.triggerEvent('deleted', {});
            state.elementsList = state.elementsList.filter(e => e.id !== this.id);
            if (this.className && tortoise.classes[this.className]) {
                const arr = tortoise.classes[this.className];
                const idx = arr.indexOf(this);
                if (idx > -1) arr.splice(idx, 1);
            }
            delete tortoise.elements[this.id];
        }

        onEvent(eventName, callback) {
            if (this.events[eventName]) this.events[eventName].push(callback);
        }

        triggerEvent(eventName, payload) {
            if (this.events[eventName]) this.events[eventName].forEach(cb => cb(payload));
        }

        getBounds() {
            const left = this.style.x - (this.style.width * this.style.anchor.x);
            const top = this.style.y - (this.style.height * this.style.anchor.y);
            return {
                left: left, right: left + this.style.width,
                top: top, bottom: top + this.style.height,
                width: this.style.width, height: this.style.height
            };
        }
    }

    function checkCollisions() {
        for (let i = 0; i < state.elementsList.length; i++) {
            for (let j = i + 1; j < state.elementsList.length; j++) {
                let el1 = state.elementsList[i];
                let el2 = state.elementsList[j];
                let b1 = el1.getBounds();
                let b2 = el2.getBounds();

                if (b1.left < b2.right && b1.right > b2.left && b1.top < b2.bottom && b1.bottom > b2.top) {
                    let dx = (b1.left + b1.width / 2) - (b2.left + b2.width / 2);
                    let dy = (b1.top + b1.height / 2) - (b2.top + b2.height / 2);
                    let width = (b1.width + b2.width) / 2;
                    let height = (b1.height + b2.height) / 2;
                    let crossWidth = width * dy;
                    let crossHeight = height * dx;
                    let colDir = '';

                    if (Math.abs(dx) <= width && Math.abs(dy) <= height) {
                        if (crossWidth > crossHeight) colDir = (crossWidth > (-crossHeight)) ? 'bottom' : 'left';
                        else colDir = (crossWidth > (-crossHeight)) ? 'right' : 'top';
                    }

                    const createEventObj = (me, other, dir) => ({
                        id: me.id,
                        collisionLocal: dir,
                        wasSpecificElementFromClass: (cName, idx) => other.className === cName && other.classIndex === idx,
                        preventWalkTrough: () => {
                            if (dir === 'left') me.style.x = b2.left - (me.style.width * (1 - me.style.anchor.x));
                            if (dir === 'right') me.style.x = b2.right + (me.style.width * me.style.anchor.x);
                            if (dir === 'top') me.style.y = b2.top - (me.style.height * (1 - me.style.anchor.y));
                            if (dir === 'bottom') me.style.y = b2.bottom + (me.style.height * me.style.anchor.y);
                        }
                    });

                    let dir2 = colDir === 'left' ? 'right' : colDir === 'right' ? 'left' : colDir === 'top' ? 'bottom' : 'top';
                    let evPayload = {
                        element1: createEventObj(el1, el2, colDir),
                        element2: createEventObj(el2, el1, dir2),
                        anyElementFromClass: (cName) => el1.className === cName || el2.className === cName
                    };

                    el1.triggerEvent('collision', evPayload);
                    el2.triggerEvent('collision', evPayload);
                }
            }
        }
    }

    function render() {
        if (!state.canvas || !state.ctx) return;

        isInternalDraw = true;

        if (state.configs.autoFrameClearing) {
            state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
        }

        state.elementsList.sort((a, b) => a.style.zIndex - b.style.zIndex);

        state.elementsList.forEach(el => {
            const s = el.style;
            state.ctx.save();

            state.ctx.globalAlpha = s.opacity;
            if (s.shadow.blur > 0) {
                state.ctx.shadowColor = s.shadow.color;
                state.ctx.shadowBlur = s.shadow.blur;
                state.ctx.shadowOffsetX = s.shadow.x;
                state.ctx.shadowOffsetY = s.shadow.y;
            }

            state.ctx.translate(s.x, s.y);
            state.ctx.rotate(s.rotation * Math.PI / 180);

            const px = -(s.width * s.anchor.x);
            const py = -(s.height * s.anchor.y);

            state.ctx.fillStyle = s.color;
            state.ctx.strokeStyle = s.borderColor;
            state.ctx.lineWidth = s.borderWidth;

            state.ctx.beginPath();
            if (s.defaultMode === 'polygon') {
                if (s.sides === 4) {
                    state.ctx.rect(px, py, s.width, s.height);
                } else {
                    const radius = s.width / 2;
                    const angle = (Math.PI * 2) / s.sides;
                    for (let i = 0; i < s.sides; i++) {
                        state.ctx.lineTo(px + radius + radius * Math.cos(angle * i), py + radius + radius * Math.sin(angle * i));
                    }
                    state.ctx.closePath();
                }
                state.ctx.fill();
                if (s.borderWidth > 0) state.ctx.stroke();
            } else if (s.defaultMode === 'circle') {
                state.ctx.arc(px + s.width / 2, py + s.height / 2, s.width / 2, 0, Math.PI * 2);
                state.ctx.fill();
                if (s.borderWidth > 0) state.ctx.stroke();
            } else if (s.defaultMode === 'text') {
                state.ctx.font = `${s.fontSize}px ${s.fontFamily}`;
                state.ctx.textBaseline = "top";
                let lines = s.textContent.split('\n');
                lines.forEach((line, i) => {
                    state.ctx.fillText(line, px, py + (i * s.fontSize * s.lineHeight));
                });
            } else if (s.defaultMode === 'image' && el.imageObj) {
                if (s.color !== '#fff' && s.color !== 'transparent') {
                    state.ctx.fillStyle = s.color;
                    state.ctx.globalAlpha = 0.5;
                    state.ctx.fillRect(px, py, s.width, s.height);
                    state.ctx.globalAlpha = s.opacity;
                }
                state.ctx.drawImage(el.imageObj, px, py, s.width, s.height);
            }

            state.ctx.restore();

            if (state.configs.autoRemoveOutterElements) {
                let b = el.getBounds();
                if (b.right < 0 || b.left > state.canvas.width || b.bottom < 0 || b.top > state.canvas.height) {
                    el.remove();
                }
            }
        });

        isInternalDraw = false;
    }

    function gameLoop(timestamp) {
        if (!state.initialized || state.paused) {
            state.loopId = requestAnimationFrame(gameLoop);
            return;
        }

        if (!timestamp) timestamp = performance.now();

        let delta = timestamp - state.lastFrameTime;
        let interval = 1000 / state.configs.fps;

        if (state.elementsList.length > state.configs.maxElementsOnScreen) {
            let toRemove = state.elementsList.length - state.configs.maxElementsOnScreen;
            for (let i = 0; i < toRemove; i++) state.elementsList[0].remove();
        }

        if (state.configs.alwaysUseMaxFps || delta >= interval) {
            if (state.configs.minFps) {
                let currentFps = 1000 / delta;
                if (currentFps < state.configs.minFps && currentFps > 0 && timestamp > 1000) {
                    throwErr(`Performance drop: FPS dropped to ${currentFps.toFixed(1)}`);
                }
            }

            state.lastFrameTime = timestamp - (delta % interval);

            state.configs.forEachFrame();
            checkCollisions();
            render();
        }
        state.loopId = requestAnimationFrame(gameLoop);
    }

    const tortoise = {
        data: {
            version: "1.0.0",
            securityVersion: "1.0.0",
            apiVersion: "1.0.0",
        },

        init: function (canvasElement) {
            if (state.initialized) return;
            if (!canvasElement || !canvasElement.getContext) throwErr("Invalid <canvas> element.");

            state.canvas = canvasElement;
            const realCtx = canvasElement.getContext('2d');
            realCtx.imageSmoothingEnabled = false;

            state.ctx = applySecurity(realCtx);

            state.canvas.addEventListener('click', (e) => {
                if (state.paused) return;
                const rect = state.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                [...state.elementsList].sort((a, b) => b.style.zIndex - a.style.zIndex).forEach(el => {
                    let b = el.getBounds();
                    if (mouseX >= b.left && mouseX <= b.right && mouseY >= b.top && mouseY <= b.bottom) {
                        el.triggerEvent('click', {});
                    }
                });
            });

            state.initialized = true;
            state.lastFrameTime = performance.now();
            state.loopId = requestAnimationFrame(gameLoop);
        },

        config: function (configs) {
            checkInit();
            Object.assign(state.configs, configs);
            if (configs.setLibName && configs.setLibName !== 'tortoise') {
                global[configs.setLibName] = tortoise;
                delete global.tortoise;
            }
        },

        togglePause: function () { checkInit(); state.paused = !state.paused; },

        kill: function () {
            state.initialized = false;
            cancelAnimationFrame(state.loopId);
            if (state.canvas && state.ctx) {
                isInternalDraw = true;
                state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
                isInternalDraw = false;
            }
            state.elementsList = [];
            tortoise.elements = { create: tortoise.elements.create };
            tortoise.classes = { create: tortoise.classes.create };
        },

        onError: function (callback) { state.errCallback = callback; },

        elements: {
            create: function(id) {
                checkInit();
                if (tortoise.elements[id]) throwErr(`Element '${id}' already exists.`);
                const el = new CanvasElement(id);
                tortoise.elements[id] = el;
                state.elementsList.push(el);
            },
            editStyle: function(id, styles) {
                checkInit();
                if (!tortoise.elements[id]) throwErr(`Element '${id}' was not found.`);
                tortoise.elements[id].editStyle(styles);
            },
            editId: function(oldId, newName) {
                checkInit();
                if (!tortoise.elements[oldId]) throwErr(`Element '${oldId}' was not found.`);
                tortoise.elements[oldId].editId(newName);
            },
            remove: function(id) {
                checkInit();
                if (!tortoise.elements[id]) throwErr(`Element '${id}' was not found.`);
                tortoise.elements[id].remove();
            },
            onEvent: function(id, eventName, callback) {
                checkInit();
                if (!tortoise.elements[id]) throwErr(`Element '${id}' was not found.`);
                tortoise.elements[id].onEvent(eventName, callback);
            },
            triggerEvent: function(id, eventName, payload) {
                checkInit();
                if (!tortoise.elements[id]) throwErr(`Element '${id}' was not found.`);
                tortoise.elements[id].triggerEvent(eventName, payload);
            }
        },

        classes: {
            create: function(className) {
                checkInit();
                if (tortoise.classes[className]) throwErr(`Class '${className}' already exists.`);
                tortoise.classes[className] = [];
            },
            createElements: function(className, quantity) {
                checkInit();
                if (!tortoise.classes[className]) throwErr(`Class '${className}' not found.`);
                
                let classArr = tortoise.classes[className];
                for (let i = 0; i < quantity; i++) {
                    let id = `_class_${className}_${Date.now()}_${Math.random()}`;
                    let el = new CanvasElement(id);
                    el.className = className;
                    el.classIndex = classArr.length;
                    tortoise.elements[id] = el;
                    
                    classArr.push(el);
                    state.elementsList.push(el);
                }
            },
            remove: function(className) {
                checkInit();
                if (!tortoise.classes[className]) throwErr(`Class '${className}' not found.`);
                
                tortoise.classes[className].forEach(el => {
                    state.elementsList = state.elementsList.filter(e => e.id !== el.id);
                    delete tortoise.elements[el.id];
                    el.triggerEvent('deleted', {});
                });
                delete tortoise.classes[className];
            },
            removeElement: function(className, index) {
                checkInit();
                if (!tortoise.classes[className]) throwErr(`Class '${className}' not found.`);
                let el = tortoise.classes[className][index];
                if (el) el.remove(); 
            },
            editName: function(oldName, newName) {
                checkInit();
                if (!tortoise.classes[oldName]) throwErr(`Class '${oldName}' not found.`);
                if (tortoise.classes[newName]) throwErr(`Class '${newName}' already exists.`);
                
                let classArr = tortoise.classes[oldName];
                classArr.forEach(el => el.className = newName);
                
                tortoise.classes[newName] = classArr;
                delete tortoise.classes[oldName];
            }
        }
    };

    global.tortoise = tortoise;

})(window);
