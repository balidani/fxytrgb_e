import { BuildProgram } from './codegen.js';
import { ShaderHandler } from './handler.js';
import { Config } from './config.js';

const testProgram = (program) => {
  let testCanvas = document.createElement('canvas');
  testCanvas.setAttribute('width', 128);
  testCanvas.setAttribute('height', 128);

  let testHandler = new ShaderHandler(testCanvas);
  testHandler.new(program);

  for (let i = 0; i < 256; ++i) {
    testHandler.step();
  }
  testHandler.draw();

  const pxTotal = testCanvas.width;

  let histogram = {};
  for (let i = 0; i < 4 * 4 * 4; ++i) {
    histogram[i] = 0;
  }

  const rgba = testHandler.get();
  testHandler.stop();
  testHandler = null;
  testCanvas = null;

  for (let i = 0; i < rgba.length; i += 4) {
    let ii = i / 4.0;
    let x = (ii % pxTotal);
    let y = (ii / pxTotal) | 0;

    const quant = (num, lim) => (num / (256 / lim)) | 0;
    const rgb = {
      r: quant(rgba[i], 4),
      g: quant(rgba[i + 1], 4),
      b: quant(rgba[i + 2], 4)};

    histogram[rgb.r * 16 + rgb.g * 4 + rgb.b] += 1;
  }

  // console.log(histogram[0] + histogram[63]);
  // console.log(histogram);

  let cnt = 0;
  for (const hist of Object.values(histogram)) {
    if (hist > 0) {
      cnt++;
    }
    if (hist > 10000) {
      return false;
    }
  }
  if (cnt < 2) {
    return false;
  }
  return true;
};

const testedProgram = () => {
  let program = null;
  let tries = 0;
  while (tries < 100) {
    program = BuildProgram();
    if (testProgram(program)) {
      return program;
    }
    tries++;
  }
  console.log('gave up');
  return BuildProgram();
};

const start = () => {
  let program = testedProgram();
  console.log(program);

  const canvas = document.getElementById('canvas');
  let handler = new ShaderHandler(canvas);
  handler.new(program);

  const play = () => {
    handler.timer = setInterval(() => {
        if (handler.t == 256) {
          console.log('fxpreview');
          fxpreview();
          // clearInterval(handler.timer);
        }
        handler.step();
        handler.draw();
        handler.t++;
      }, 10);
  };

  const record = async () => {
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    for (let t = 0; t < 4096; ++t) {
      handler.step();
      handler.draw();
      handler.t += 8;

      var download = function() {
        var link = document.createElement('a');
        const tt = String(t).padStart(4, '0');
        link.download = `frame${tt}.png`;
        link.href = document.getElementById('canvas').toDataURL()
        link.click();
      };
      requestAnimationFrame(download);
      await sleep(500);
    }

  };

  setTimeout(() => {
    play();
    // record();
  }, 0);

  // const next = () => {
  //   location.reload();
  //   // program = testedProgram();
  //   // clearInterval(handler.timer);
  //   // handler.new(program);

  //   // setTimeout(() => {
  //   //   play();
  //   // }, 0);
  // }

  // window.addEventListener('touched', () => {
  //   next();
  // });
  // window.addEventListener('click', () => {
  //   next();
  // });

};
start();

document.getElementById('canvas').addEventListener('click', function() {
    window.location.reload();
});
