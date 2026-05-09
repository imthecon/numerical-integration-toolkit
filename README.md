# numerical integration toolkit by sarder

An interactive numerical integral visualizer with precise and accurate computations including error bounds.

## Official link
https://imthecon.github.io/numerical-integration-toolkit

## Current features
- **A function mapper:** type in a function as a string (according to math.js formatting) to graph it.
  - Zoom, panning, and reset position controls.
  - Choose integration method from dropdown menu (including Left & Right Riemann, Midpoint rule, and Trapezoidal rule).
  - Customize number of subdivisions (n), integration intervals (a, b), result rounding, and appearance of graph.

- **Computations:** see the formulas and results of all integration methods.

- **Error bounds:** compute precise error bounds including Midpoint Rule and Trapezoidal Rule.
  - Calculate the upper bound of error for an integration method (calculated using the Bisection method; refined using Newton's method).
  - Read summaries explaining how to calcuulate and interpret error bounds manually.
 
- **A questions and information section:** read important snippets explaining how to use the function mapper, how to enter values, and current limitations + future updates.

## How to create your own copy of this repository:
1. Download and install Node.js from the Node.js official website.
2. Create a file in a code editor (e.g., VS Code) and run `git clone https://github.com/imthecon/numerical-integration-toolkit` in a terminal.
3. Run `cd numerical-integration-toolkit` to enter the folder of the project.
4. Install all required dependencies by running `npm install`.
5. Start the localhost development server by running `npm run dev`.

## License
Apache 2.0
