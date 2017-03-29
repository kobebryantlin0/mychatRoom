# OneAPM Agent for Node.js

![](https://img.shields.io/npm/v/oneapm.svg)
[![](https://npm.taobao.org/badge/v/oneapm.svg)](http://npm.taobao.org/package/oneapm)
![](https://img.shields.io/node/v/oneapm.svg)
[![](https://img.shields.io/travis/oneapm/agent-demo-nodejs.svg)](https://travis-ci.org/oneapm/agent-demo-nodejs)

## 安装

1. 在需要监控的APP根目录安装`oneapm`模块 `npm install oneapm`
2. 拷贝 `node_modules/oneapm/oneapm.js` 到APP根目录
3. 修改配置文件 `oneapm.js`，将 `license_key` 的值修改为您的OneAPM帐号中的 `license_key`
4. 将 `var oneapm = require('oneapm');` 写到APP主模块文件的第一行

## 浏览器性能监控

将 `oneapm.getBrowserTimingHeader()` 写到html模板的 `<head>` 标签的开头。（如果`<head>`中存在`X-UA-COMPATIBLE HTTP-EQUIV`等meta tags，请将语句写到meta tags之后，以便监控的更加精准。）

### 例子
*app.js*

```javascript
   var oneapm = require('oneapm');
   var app = require('express')();
   app.locals.oneapm = oneapm;
   app.get('/user/:id', function (req, res) {
      res.render('user');
   });
   app.listen(process.env.PORT);
```

*layout.jade:*

```jade
doctype html
html
  head
    != oneapm.getBrowserTimingHeader()
    title= title
    link(rel='stylesheet', href='/stylesheets/style.css')
  body
    block content
```

## 更新日志

### v1.2.20 (2016-02-25)

* 支持mysql2
* 完善了错误处理机制


### v1.2.19 (2016-01-14)

* 错误详情显示请求头信息

### v1.2.18 (2016-01-07)

* 增加对PostgreSQL（pg）的支持


### v1.2.17 (2015-12-28)

* 增加对Thrift框架中错误的捕捉

### v1.2.16 (2015-12-22)

* 增加对Thrift的支持
* 修复了错误率不正常的bug

### v1.2.15 (2015-12-09)

* Windows 下恢复 CPU 的采样 
* 修复了在某种特殊情况下读取依赖导致CPU占用率过高的bug

### v1.2.14 (2015-11-13)

* 修复了一个JSON包解析的bug

### v1.2.13 (2015-11-09)

* 慢事务详情页面展示 Trace 信息

### v1.2.12 (2015-11-03)

* 添加数据库追踪中的慢 SQL 追踪
* 慢事务详情页面展示抓取到 SQL 语句

### v1.2.11 (2015-10-26)

* 缩小了安装包的大小

### v1.2.10 (2015-10-26)

* 修复了 MySQL Query 参数解析的问题

### v1.2.9 (2015-10-10)

* 修复了和 Node.JS 4.1.1 的兼容性问题

### v1.2.8 (2015-09-10)

* 发布到 npmjs.com

### v1.2.6 (2015-09-08)

* Windows 下禁用 CPU 的采样 

### v1.2.5 (2015-08-25)

* AI 数据与 BI 数据串联
* MySQL 连接池的支持

### v1.2.4 (2015-07-23)

* 新增对 Docker 运行环境的检测
* 修复了 KrakenJS 兼容问题
* 更详细的 BI 探针报错信息

### v1.2.3 (2015-06-12)

* 修复了在 iojs 下无法启动探针的问题
* 支持发布到 NPM 
* CPU 使用率上报支持 Windows 和 Mac

### v1.2.2 (2015-05-20)

* 错误采集支持自定义属性
* 内存使用上报
* CPU使用率尚上报，只支持 Linux
* 改进了对 NOSQL 数据的展示

### v1.2.1 (2015-04-22):

* restart the agent if configuration is changed
* database throughput information
* fix duplicate paths in express framework

### v1.1.1 (2015-04-03):

* include uri in slow transaction trace
* fix duplicate dash problem in Express application
* improve support of Express 4.x sub routine
* distribution package size is shrinked
* add web/other sub category of errors 

### v1.1.0 (2015-03-16):

* add thinkjs support
* remove application name restriction

### v1.0.1 (2014-08-07):

* add proxy support

### v1.0.0 (2014-07-30):

* release
* adapt tpm server
