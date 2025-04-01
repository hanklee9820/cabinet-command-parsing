const fs = require('fs');
const path = require('path');
const Terser = require('terser');
const htmlMinifier = require('html-minifier');

async function build() {
  try {
    // 确保docs目录存在
    if (!fs.existsSync('docs')) {
      fs.mkdirSync('docs');
    }

    // 读取并混淆 JS 文件
    const jsContent = fs.readFileSync('src/protocol-parser.js', 'utf8');
    const jsResult = await Terser.minify(jsContent, {
      compress: {
        dead_code: true,
        drop_console: true,
        drop_debugger: true,
        keep_classnames: true,
        keep_fnames: true
      },
      mangle: {
        keep_classnames: true,
        keep_fnames: true
      },
      output: {
        comments: /^!/  // 保留以 ! 开头的注释（版权信息）
      }
    });

    // 写入混淆后的 JS 文件
    fs.writeFileSync('docs/protocol-parser.js', jsResult.code);

    // HTML压缩配置
    const htmlMinifierConfig = {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true
    };

    // 处理 index.html
    let indexHtmlContent = fs.readFileSync('src/index.html', 'utf8');
    const minifiedIndexHtml = htmlMinifier.minify(indexHtmlContent, htmlMinifierConfig);
    fs.writeFileSync('docs/index.html', minifiedIndexHtml);

    // 处理 test.html
    let testHtmlContent = fs.readFileSync('src/test.html', 'utf8');
    const minifiedTestHtml = htmlMinifier.minify(testHtmlContent, htmlMinifierConfig);
    fs.writeFileSync('docs/test.html', minifiedTestHtml);

    console.log('构建完成！文件已生成到 docs 目录');
  } catch (error) {
    console.error('构建过程中发生错误:', error);
    process.exit(1);
  }
}

build(); 