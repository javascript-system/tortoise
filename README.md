# 🐢 Tortoise.js v1.0.0

**Tortoise.js** is a high-performance, object-oriented wrapper for the HTML5 Canvas API. It focuses on **security**, **simplicity**, and **declarative management** of canvas elements.

---

## 🚀 Key Features
* **Context Security**: Prevents raw access to the Canvas 2D context to ensure engine stability by intercepting native methods like `fillRect`.
* **Object-Oriented Elements**: Manage shapes, text, and images as stateful objects rather than raw pixels.
* **Automatic Collision System**: Built-in AABB collision detection with directional feedback (`top`, `bottom`, `left`, `right`).
* **Class System**: Group and manipulate multiple elements simultaneously for bulk updates.
* **Performance Monitoring**: Optional minimum FPS tracking that triggers error callbacks if performance drops.

---

## 🛠 Installation

Simply include the library in your HTML file:
```html
<script src="path/to/tortoise.js"></script>
```

---

## 📖 API Documentation

### 1. Management Functions
Functions to control the engine's core lifecycle.

* **`tortoise.init(canvasElement)`**: Binds the engine to a `<canvas>` and starts the game loop.
* **`tortoise.config(options)`**: Configures global settings such as `fps`, `autoFrameClearing`, and `autoRemoveOutterElements`.
* **`tortoise.togglePause()`**: Pauses or resumes the engine updates and rendering.
* **`tortoise.kill()`**: Stops the engine and wipes all internal memory.

### 2. Elements API
Manage individual objects on the screen.

* **`tortoise.elements.create(id)`**: Creates a new element with a unique ID.
* **`tortoise.elements.editStyle(id, config)`**: Updates appearance, position, and physics properties.
* **`tortoise.elements.remove(id)`**: Deletes an element from the engine.

#### Style Properties
| Property | Description | Default |
| :--- | :--- | :--- |
| `defaultMode` | Render mode: 'polygon', 'circle', 'text', or 'image' | 'polygon' |
| `x`, `y` | Canvas coordinates | 0, 0 |
| `width`, `height` | Dimensions of the element | 50, 50 |
| `zIndex` | Render depth (higher values are on top) | 0 |
| `anchor` | Pivot point for rotation/position {x, y} | 0.5, 0.5 |
| `color` | Fill color string | '#fff' |

### 3. Events & Collisions
Tortoise.js uses an event-driven architecture.

* **`tortoise.elements.onEvent(id, event, callback)`**: Listen for `click`, `collision`, `deleted`, `styled`, or `renamed`.

#### Collision Data
The `collision` event provides a data object:
```javascript
tortoise.elements.onEvent('player', 'collision', (data) => {
    // data.collisionLocal returns 'top', 'bottom', 'left', or 'right'
    data.element1.preventWalkTrough(); // Prevents overlapping
});
```

### 4. Classes (Groups)
Handle multiple elements as a single group for efficiency.

* **`tortoise.classes.create(name)`**: Initializes a group.
* **`tortoise.classes.createElements(name, quantity)`**: Spawns multiple elements into the class.
* **`tortoise.classes.remove(name)`**: Deletes the class and all its associated elements.

---

## 🛡 Security Layer
Tortoise.js intercepts native Canvas methods. If you attempt to use `ctx.fillRect()` directly on the initialized canvas, the engine throws a `TortoiseError`. This ensures all drawing is managed through the engine's optimized pipeline.

## 📄 License
This project is licensed under the BSD 3-Clause License, so always input credits on work, if you don't want to use credits, doesn't declare that the project is 100% yours.


For more information access our [website](https://tortoise-js.onrender.com)
