/**
 * Maze Widget - A customizable maze generator with canvas rendering
 * 
 * @version 1.0.0
 * @author JFCartier
 * @license MIT
 * @repository https://github.com/jfcmontmorency/maze-widget
 * 
 * Copyright (c) 2025 Jean-François
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Creates a customizable maze widget with canvas rendering
 * 
 * @param {HTMLElement|string} mount - Container element or CSS selector
 * @param {Object} options - Configuration options
 * @param {number} [options.cols=5] - Number of columns in the maze
 * @param {number} [options.rows=5] - Number of rows in the maze  
 * @param {string} [options.wallColor="#ffffff"] - Color of the maze walls
 * @param {string} [options.bgColor="#000000"] - Background color
 * @param {number} [options.lineWidthRatio=0.25] - Wall thickness as ratio of cell size
 * @param {number} [options.seed=983811] - Random seed for consistent maze generation
 * @param {Object} [options.entry] - Entry point configuration
 * @param {Object} [options.exit] - Exit point configuration
 * @param {string} [options.squareBy="width"] - How to calculate square dimensions
 * @param {number} [options.padding=0] - Internal padding in pixels
 * @returns {Object} API object with methods: { regenerate, redraw, setOptions, destroy, getState }
 * 
 * @example
 * // Basic usage
 * const maze = createMazeWidget('#container');
 * 
 * // With custom options
 * const maze = createMazeWidget('#container', {
 *   cols: 10,
 *   rows: 10,
 *   wallColor: '#ff0000',
 *   seed: 12345
 * });
 * 
 * // Regenerate with new seed
 * maze.setOptions({ seed: Math.random() * 1000000 });
 */
export function createMazeWidget(mount, options = {}) {
  // ---------- Utils ----------
  const defaults = {
    cols: 5,
    rows: 5,
    wallColor: "#ffffff",
    bgColor: "#000000",
    lineWidthRatio: 0.25, // proportion de l’épaisseur des murs vs la taille d’une cellule
    seed: 983811,
    entry: { x: 0, y: 0, side: "top" },
    exit: { x: null, y: null, side: "bottom" }, // null => rows-1/cols-1 calculé
    squareBy: "width", // "width" ou "min" (min(width, height))
    padding: 0 // padding interne au wrapper (px)
  };

  const opts = { ...defaults, ...options };
  const mountEl =
    typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!mountEl) throw new Error("createMazeWidget: mount element not found.");

  // Wrapper + canvas (auto-injectés, style minimal)
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = "100%";
  wrap.style.height = "100%";
  wrap.style.display = "block";
  wrap.style.boxSizing = "border-box";
  wrap.style.padding = `${opts.padding}px`;

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  wrap.appendChild(canvas);
  mountEl.appendChild(wrap);

  const ctx = canvas.getContext("2d");

  // ---------- RNG, grid & carving ----------
  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }

  function createGrid(cols, rows) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        visited: false,
        walls: { top: true, right: true, bottom: true, left: true }
      }))
    );
  }

  function carveMaze({ cols, rows, seed, entry, exit }) {
    const grid = createGrid(cols, rows);
    const rnd = createSeededRandom(seed);
    const stack = [{ x: 0, y: 0 }];
    grid[0][0].visited = true;

    const dirs = [
      { dx: 0, dy: -1, wall: "top", opp: "bottom" },
      { dx: 1, dy: 0, wall: "right", opp: "left" },
      { dx: 0, dy: 1, wall: "bottom", opp: "top" },
      { dx: -1, dy: 0, wall: "left", opp: "right" }
    ];

    function neighborsUnvisited(x, y) {
      return dirs
        .map((d) => ({ ...d, nx: x + d.dx, ny: y + d.dy }))
        .filter(
          (n) =>
            n.nx >= 0 &&
            n.nx < cols &&
            n.ny >= 0 &&
            n.ny < rows &&
            !grid[n.ny][n.nx].visited
        );
    }

    while (stack.length) {
      const cur = stack[stack.length - 1];
      const unv = neighborsUnvisited(cur.x, cur.y);
      if (unv.length) {
        const next = unv[Math.floor(rnd() * unv.length)];
        grid[cur.y][cur.x].walls[next.wall] = false;
        grid[next.ny][next.nx].walls[next.opp] = false;
        grid[next.ny][next.nx].visited = true;
        stack.push({ x: next.nx, y: next.ny });
      } else {
        stack.pop();
      }
    }

    // Entrée / sortie
    const ent = entry || { x: 0, y: 0, side: "top" };
    const ex = exit || { x: cols - 1, y: rows - 1, side: "bottom" };
    const entryFinal = {
      x: ent.x ?? 0,
      y: ent.y ?? 0,
      side: ent.side || "top"
    };
    const exitFinal = {
      x: ex.x ?? cols - 1,
      y: ex.y ?? rows - 1,
      side: ex.side || "bottom"
    };

    grid[entryFinal.y][entryFinal.x].walls[entryFinal.side] = false;
    grid[exitFinal.y][exitFinal.x].walls[exitFinal.side] = false;

    return grid;
  }

  // ---------- State ----------
  let grid = carveMaze({
    cols: opts.cols,
    rows: opts.rows,
    seed: opts.seed,
    entry: opts.entry,
    exit: opts.exit
  });

  // ---------- Drawing ----------
  function measureSquare() {
    const rect = wrap.getBoundingClientRect();
    if (opts.squareBy === "min") {
      return Math.floor(Math.min(rect.width, rect.height));
    }
    return Math.floor(rect.width); // par défaut basé sur la largeur
  }

  function draw() {
    const cssSize = measureSquare();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    // on garde le canvas rempli, mais l’affichage “css” reste 100%
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    // fond
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, cssSize, cssSize);

    const cols = opts.cols;
    const rows = opts.rows;
    const cell = cssSize / cols;
    // épaisseur de ligne responsive vs la taille de la cellule
    const t = Math.max(1, Math.ceil(cell * opts.lineWidthRatio));

    ctx.fillStyle = opts.wallColor;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const w = grid[y][x].walls;
        const px = Math.floor(x * cell);
        const py = Math.floor(y * cell);
        const cellSize = Math.ceil(cell);

        if (w.top) ctx.fillRect(px, py, cellSize, t);
        if (w.left) ctx.fillRect(px, py, t, cellSize);
        if (x === cols - 1 && w.right)
          ctx.fillRect(px + cellSize - t, py, t, cellSize);
        if (y === rows - 1 && w.bottom)
          ctx.fillRect(px, py + cellSize - t, cellSize, t);
      }
    }
  }

  // ---------- Resize handling ----------
  const ro = new ResizeObserver(() => draw());
  ro.observe(wrap);
  window.addEventListener("resize", draw, { passive: true });

  // premier rendu
  draw();

  // ---------- Public API ----------
  function regenerate(newOptions = {}) {
    Object.assign(opts, newOptions);
    grid = carveMaze({
      cols: opts.cols,
      rows: opts.rows,
      seed: opts.seed,
      entry: opts.entry,
      exit: opts.exit
    });
    draw();
  }

  function redraw() {
    draw();
  }

  function setOptions(partial) {
    Object.assign(opts, partial);
    draw();
  }

  function destroy() {
    ro.disconnect();
    window.removeEventListener("resize", draw);
    wrap.remove();
  }

  function getState() {
    return {
      options: { ...opts },
      grid: JSON.parse(JSON.stringify(grid)),
      canvas,
      mount: mountEl
    };
  }

  return {
    regenerate,
    redraw,
    setOptions,
    destroy,
    getState,
    canvas,
    mount: mountEl
  };
}
