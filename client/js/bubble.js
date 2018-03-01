$(function() {
    var ws = '';
    var init = false;
    var ip = '';
    var ip_api = 'http://chaxun.1616.net/s.php?type=ip&output=json&callback=?&_='+Math.random();
    detectIE();
    checkws();
    
    $.get("https://api.ipdata.co", function (response) {
        console.log(response);
        ip = response.ip;
        start('正在建立连接...');
    }, "jsonp");

    function start(msg) {
        waitingDialog.show(msg, {
            dialogSize: 'sm',
            progressType: 'warning',
            onHide: function() {
                check_login();
            }
        });
        ws = new WebSocket("ws://bubble.hejunhao.me/ws");
        ws.onopen = function(e) {
            if (init) {
                message_alert('重连成功!', '', 'success', 'bubble_alert_on_ws_reconnect');
            }
            setTimeout(function() {
                waitingDialog.hide();
            }, 1000);

        }
        ws.onclose = function(e) {
                var time = new Date().toLocaleString()
            console.log('Close:' + time);
            console.log('Connection has lost , websocket will try to reconnect after 5 seconds');
            message_alert('连接已经断开，正在重新连接...', '', 'danger', 'bubble_alert_on_ws_error');
            //重新连接
            setTimeout(function() {
                start('正在重连...');
            }, 5000);
        }
        ws.onerror = function(e) {
            console.debug('Error occured:' + e.data)
        }
        ws.onmessage = function(e) {
            msg = $.parseJSON(e.data);
            act = msg.action
            data = msg.data;
            switch (act) {
                case 'open':
                        var time = new Date().toLocaleString();
                    console.log('Successfully connect to the server! ' + time);
                    break;

                case 'init':
                    if (!init) {
                        init = true;
                        console.debug(data);
                        $.each(data, function() {
                                if (this.media == 1) {
                                    this.content = '<a class="fancybox" href="'+ this.content+'"><img src="'+ this.content+'" class="imgcomment"></a>';
                                }
                            insert_comment_item('grouproom', this.username, this.avatar, this.time, this.content, 0.1);
                        });
                    }
                    break;

                case 'error':
                    swal('出错啦!', msg.info, 'error');
                    break;

                case 'login':
                    var code = msg.code;
                    if (code == -101) {
                        swal({
                            title: 'Opps!',
                            text: msg.info,
                            confirmButtonText: '换一个',
                            type: "warning"
                        }, function(isConfirm) {
                            if (isConfirm) {
                                Cookies.remove('bubble_username');
                                check_login();
                            }
                        });
                    } else if (code == 403) {
                            swal({
                            title: 'Opps!',
                            text: msg.info,
                            showConfirmButton: false,
                            type: "warning"
                        });
                    } else if (code == 200) {
                        //Cookie 保留一天
                        Cookies.set('bubble_username', data.username, {
                            expires: 1
                        });
                        $("#bubble_username").val(data.username);
                        insert_contract_list_item(data.username, data.avatar, true);
                        $.each(data.online, function(i, usr) {
                            insert_contract_list_item(usr.username, usr.avatar, false);
                        });
                        $("#login").modal('hide');
                        $("#login").hide();
                    }
                    break;

                case 'chat':
                    if (msg.code == 200) {
                        add_tab(data.room, data.room_icon)
                        if (data.media == 1) {
                                data.content = '<a class="fancybox" href="'+ data.content+'"><img src="'+ data.content+'" class="imgcomment"></a>';
                                if( data.username == $('#bubble_username').val() ){
                                    waitingDialog.hide();
                                }
                        }
                        insert_comment_item(data.room, data.username, data.avatar, data.time, data.content, 1000);
                        if (!document.hasFocus()) {
                            document.title = "【有新的消息】";
                        }
                    
                    } else if (msg.code == -101) {
                        swal({
                            title: '发送失败!',
                            text: msg.info,
                            type: 'warning'
                        });
                        waitingDialog.hide();
                    }
                    break;
                    
                case 'online':
                    insert_contract_list_item(data.username, data.avatar, false);
                    message_alert(data.username + " 上线了!", data.avatar, 'success', 'online_' + data.username);
                    break;

                case 'offline':
                    remove_contract_list_item(data.username);
                    message_alert(data.username + " 已离线.", data.avatar, 'danger', 'offline_' + data.username);
                    break;

                default:
                    break;
            }
        }
    }

    /**
     * 快捷回复
     */
    $('body').on('keypress', 'textarea', function(e) {
        if ((e.ctrlKey || e.shiftKey) && (e.keyCode == 10 || e.keyCode == 13)) {
            $(this).parent().children('.chat-submit').trigger('click');
            e.preventDefault();
        }
    });

    /**
     * 顶部tab添加
     */
    $("body").on('click', ".list-group-item-scale", function(e) {
        username = $(this).data('username');
        avatar = $(this).data('avatar');
        $("#nav-tabs > li[class='active']").attr('class', "");

        if ($("#nav-tabs > li[data-username='" + username + "']").length > 0) {
            activeTab(username);
        } else { //第一次添加
            add_tab(username, avatar);
            activeTab(username);
            var robot = 'Bubble机器人';
            if (username == robot) {
                setTimeout(function() {
                    var content = '<strong class="text-info">哈喽，我是一名机器人，我上知天文下知地理，所以你尽情发问吧，例如“今天广州的天气怎样” 、 “广州到珠海的高铁”、“宫爆鸡丁怎么做啊”、“今天有什么娱乐新闻”、“今天有什么大事啊”、“讲个笑话来听听”、“4004+34324*1230/324”......</strong>';
                    insert_comment_item(robot, robot, 'robot', '1st second', content, 1000);
                }, 500);
            }
        }
    });

    $('body').on('click', '.chat-submit', function(e) {
        e.preventDefault();
        var from = $("#bubble_username").val();
        var category = $(this).data('category');
        var to = $(this).data('room');
        var content = $.trim($('#reply_' + to).val());
        var len = content.length;
        if (len == 0) {
            swal({
                title: '内容不能为空',
                text: '您无语了吗？',
                confirmButtonText: '对不起',
                allowOutsideClick: true,
                type: "warning"
            });
        } else if (len > 500) {
            swal({
                title: '内容太长',
                text: '字数不能多于500字',
                confirmButtonText: 'OK',
                allowOutsideClick: true,
                type: "warning"
            });
        } else {
            ws.send($.toJSON({
                'action': 'chat',
                'content': content,
                'category': category,
                'from': from,
                'to': to,
                'media':0
            }));
            $('#reply_' + to).val('');
        }
    });

    /**
     * 双击自适应放大 
     */
    $('body').on('dblclick', '.chatbox', function(e) {
        if ($(this)[0].scrollHeight > 400) {
            $(this).tooltip('disable');
        }
        currHeight = $(this).height()
        $(this).stop().height(currHeight).animate({
            height: $(this)[0].scrollHeight
        }, "slow");
    });

    /**
     * 鼠标离开自适应调整窗体
     */
    $('body').on('mouseleave', '.chatbox', function(e) {
        $(this).stop().animate({
            height: 350
        }, "slow", function() {
            $(this).animate({
                scrollTop: $(this)[0].scrollHeight
            }, 1000);
        });
    });

    /**
     * 提示
     */
    $('body').on('mouseenter', '.chatbox', function(e) {
        $(this).stop(true);
        if ($(this)[0].scrollHeight > 400) {
            $(this).tooltip('show');
        }

    });

    /**
     * 隐藏badge
     */
    $('body').on('show.bs.tab', 'a[data-toggle="tab"]', function(e) {
        $(this).find('.badge').hide();
        var username = $(this).parent().data('username');
        $.each($('#tab_' + username + ' article[data-unread="1"]'), function() {
            $(this).attr('data-unread', '0');
        });
    });

    /**
     * 新窗口打开媒体链接
     */
    $('body').on('click', '.media', function(e) {
        var media_link = $(this).data('link');
        if (media_link) {
            var win = window.open(media_link, '_blank');
            win.focus();
        }
    });

    /**
     * 登录检测
     */
    $('#btn-login').on('click', function(e) {
        username = $('#login_username').val();
        if (!username.match(/^[\u4E00-\u9FA5a-zA-Z0-9_]{2,6}$/)) {
            swal({
                title: '非法昵称！',
                text: '昵称只能包含汉字、字母、数字或下划线，长度为2~6个字符',
                confirmButtonText: '对不起',
                type: "warning"
            });
        } else {
            ws.send($.toJSON({
                'action': 'login',
                'username': username
            }));
        }
    });

    /**
     * 插入表情
     */
    $("body").on('click', '.fa-smile-o', function(e) {
        e.preventDefault();
        var target = $(this).parents('form').children('textarea');
        $(this).sinaEmotion(target);
        e.stopPropagation();
    });
    
    /**
     * 发送图片
     */
    $('body').on('click', '.fa-file-image-o', function(e) {
        $(this).parent().children('input').trigger('click');
    });

    $('body').on('change', '.sendpic', readImage);
    
    /**
     * 大图预览 
     */
    $(".fancybox").fancybox({
        openEffect  : 'elastic',
        closeEffect : 'elastic'
    });
    
    /**
     * 获取图片base64
     */
    function readImage() {//大图预览;进度条;
        if ( this.files && this.files[0] ) {
                var currform = $(this).parents('form');
                var currfile = this.files[0];
                var mime = ['image/png', 'image/jpeg', 'image/bmp', 'image/gif']
            var FR = new FileReader();
            var category = $(this).data('category');
            var to = $(this).data('room');
            var from = $("#bubble_username").val();
            var IMAGE_LIMIT_SIZE = 1.0*1024*1024;
            var imgData = '';
            FR.onload = function(e) {
                    if ($.inArray( currfile.type, mime )==-1){
                        swal('非法文件', '只支持发送png、jpg、bmp和gif类型的图片', 'warning');
                        console.debug(currfile.type);
                    } else if (currfile.size > IMAGE_LIMIT_SIZE) { //大于1MB需要压缩
                        waitingDialog.show('正在发送...', {
                            dialogSize: 'sm',
                            progressType: 'success',
                            onHide:function(){}
                    });
                        lrz(currfile, {quality:0.4})
                    .then(function (rst) {
                            console.debug('压缩前大小：'+currfile.size/1024+'KB');
                            console.debug('压缩后大小：'+rst.fileLen/1024+'KB'+'   Base64Len：'+rst.base64Len/1024+'KB');
                        if (rst.base64Len > IMAGE_LIMIT_SIZE) {
                                swal('警告!', '您的图片太大啦!', 'warning');
                                waitingDialog.hide();
                        } else {
                                imgData = rst.base64;
                                ws.send($.toJSON({
                                'action': 'chat',
                                'content': imgData,
                                'category': category,
                                'from': from,
                                'to': to,
                                'media':1
                                }));
                        }
                    }).catch(function (err) {
                        swal('出错啦!', '压缩图片过程中出错，建议换一张重试.', 'error');
                        waitingDialog.hide();
                    }).always(function(){
                            currform[0].reset();
                    });
                        
                    } else {
                        imgData = e.target.result;
                        ws.send($.toJSON({
                        'action': 'chat',
                        'content': imgData,
                        'category': category,
                        'from': from,
                        'to': to,
                        'media':1
                        }));
                        waitingDialog.show('正在发送...', {
                            dialogSize: 'sm',
                            progressType: 'success',
                            onHide:function(){}
                    });
                        currform[0].reset();
                    }
            };       
            FR.readAsDataURL( this.files[0] );
        }
    }
        
    /**
     * 检测登录状态
     */
    function check_login() {
        var username = Cookies.get('bubble_username');
        if (username) {
            ws.send($.toJSON({
                'action': 'login',
                'username': username,
                'ip':ip
            }));
        } else {
            $("#login").modal('show');
        }
    }

    /**
     * 添加tab元素
     * @param {Object} username
     * @param {Object} avatar
     */
    function add_tab(username, avatar) {

        var category = username == 'Bubble机器人' ? 'robot' : 'private';

        if ($("#nav-tabs > li[data-username='" + username + "']").length > 0) {
            return;
        }

        tab_html = '<li class="" data-username="' + username + '">' +
            '<a href="#tab_' + username + '" data-toggle="tab">' +
            '<img class="img-circle" src="img/avatar/' + avatar + '.png" />' +
            '<span class="badge badge-danger" style="display:none;"></span>' +
            '<span class="quote"><i class="fa fa-commenting"></i></span>' +
            '</a>' +
            '</li>';
        $(tab_html).appendTo('#nav-tabs');

        tab_content_html = '<div class="tab-pane fade in" id="tab_' + username + '">' +
            '<div class="tab-inner">' +
            '<div class="row">' +
            '<div class="col-md-12">' +
            '<h3 class="page-header">与 ' + username + ' 的私人聊天</h3>' +
            '<section class="comment-list well chatbox" data-title="双击放大" data-placement="top">' +
            '</section>' +
            '<div class="row">' +
            '<div class="col-md-12">' +
            '<div class="widget-area no-padding blank">' +
            '<div class="reply">' +
            '<form>' +
            '<textarea placeholder="请输入点什么..." id="reply_' + username + '"></textarea>' +
            '<ul>' +
            '<li><i class="fa fa-smile-o"></i></li>' +
            '<li><i class="fa fa-file-image-o"></i><input type="file" class="sendpic hidden" data-room="' + username + '" data-category="' + category + '" /></li>' +
            '</ul>' +
            '<button class="btn btn-success green chat-submit" data-room="' + username + '" data-category="' + category + '"><i class="fa fa-reply"></i>Send</button>' +
            '<text>(Ctrl + Enter)</text>' +
            '</form>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>'

        $(tab_content_html).appendTo(".tab-content");
    }

    /**
     * 动态tab切换
     * @param {Object} username
     */
    function activeTab(username) {
        $('#nav-tabs a[href="#tab_' + username + '"]').tab('show');
    };

    /**
     * 插入在线联系人列表
     * @param {Object} username 名字
     * @param {Object} is_own 是否为自身
     */
    function insert_contract_list_item(username, avatar, is_own) {
        //已经存在
        if ($("#contact-list > li[data-username='" + username + "']").length > 0) {
            return false;
        }
        var avatar_path = 'img/avatar/' + avatar + '.png';
        if (is_own) {
            var html_content =
                '<li class="list-group-item" data-username="' + username + '" data-avatar="' + avatar + '">' +
                '<div class="col-xs-12 col-sm-12 col-md-4 col-lg-3">' +
                '<img src="' + avatar_path + '"  class="img-responsive img-circle" />' +
                '</div>' +
                '<div class="col-xs-12 col-sm-12 col-md-8 col-lg-9 text-center">' +
                '<span class="name text-danger"><strong>' + username + '</strong></span><br/>' +
                '</div>' +
                '<div class="clearfix"></div>' +
                '</li>';

        } else {
            var html_content =
                '<li class="list-group-item list-group-item-scale" data-username="' + username + '" data-avatar="' + avatar + '">' +
                '<div class="col-xs-12 col-sm-12 col-md-4 col-lg-3">' +
                '<img src="' + avatar_path + '"  class="img-responsive img-circle" />' +
                '</div>' +
                '<div class="col-xs-12 col-sm-12 col-md-8 col-lg-9 text-center">' +
                '<span class="name"><strong>' + username + '</strong></span><br/>' +
                '</div>' +
                '<div class="clearfix"></div>' +
                '</li>';
        }


        if (is_own) { //前插入
            $(html_content).prependTo("#contact-list");
        } else { //追加插入
            $(html_content).appendTo("#contact-list");
        }
    }

    /**
     * 移除下线联系人 
     * @param {Object} username
     */
    function remove_contract_list_item(username) {
        if ($("#contact-list > li[data-username='" + username + "']").length > 0) {
            $("#contact-list > li[data-username='" + username + "']").remove();
        }
    }

    /**
     * 信息弹出 
     * @param {Object} message
     * @param {Object} img 
     * @param {Object} type 
     * @param {Object} id 
     */
    function message_alert(message, img, type, id) {
        img_content = img === '' ? '' : '<img src="img/avatar/' + img + '.png"/>';
        html_content = '<div style="display:none" class="alert alert-' + type + '" id="' + id + '">' + img_content + message + '</div>';
        $(html_content).prependTo('#message-div');
        //防止大量弹窗溢出
        if ($('#message-div').children().length > 5) {
            $('#message-div>div:last-child').remove();
        }
        $('#' + id).fadeIn("slow");
        $('#' + id).delay(3000).fadeOut("slow", function() {
            $('#' + id).remove();
        });
    }

    /**
     * 检测Websocket兼容
     */
    function checkws() {
        if (!window.WebSocket) {
            swal({
                title: "错误",
                text: "您当前的浏览器不支持Websocket API , 不支持聊天功能!（双核浏览器请切换至极速模式）",
                type: "error",
                confirmButtonText: "请更换浏览器重试"
            }, function(isConfirm) {
                location.reload()
            });
        }
    }

    /**
     * 插入聊天内容 
     * @param {Object} roomname
     * @param {Object} username
     * @param {Object} avatar
     * @param {Object} time
     * @param {Object} content
     * @param {Object} duration
     */
    function insert_comment_item(roomname, username, avatar, time, content, duration) {
        type = username == $("#bubble_username").val() ? 'right' : 'left';
        unread = $('.tab-content > .active').attr('id') == 'tab_' + roomname ? 0 : 1;
        if (type == 'left') {
            var html_content =
                '<article class="row" data-unread="' + unread + '">' +
                '<div class="col-md-2 col-sm-3 hidden-xs">' +
                '<figure class="thumbnail">' +
                '<img class="img-responsive" src="img/avatar/' + avatar + '.png" />' +
                '</figure>' +
                '</div>' +
                '<div class="col-md-10 col-sm-9 ">' +
                '<div class="panel panel-default arrow left">' +
                '<div class="panel-body">' +
                '<header class="text-left text-muted">' +
                '<div class="comment-user"><i class="fa fa-user"></i><name> ' + username + ' </name><i class="fa fa-clock-o"></i> ' + time + '</div>' +
                '</header>' +
                '<div class="comment-post">' +
                '<p>' +
                content +
                '</p>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</article>';

        } else if (type == 'right') {
            var html_content =
                '<article class="row" data-unread="' + unread + '">' +
                '<div class="col-md-10 col-sm-9 text-right">' +
                '<div class="panel panel-default arrow right">' +
                '<div class="panel-body">' +
                '<header class="text-right  text-muted">' +
                '<div class="comment-user"><i class="fa fa-user"></i> <name>' + username + ' </name><i class="fa fa-clock-o"></i> ' + time + '</div>' +
                '</header>' +
                '<div class="comment-post">' +
                '<p>' +
                content +
                '</p>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="col-md-2 col-sm-3 hidden-xs">' +
                '<figure class="thumbnail">' +
                '<img class="img-responsive" src="img/avatar/' + avatar + '.png" />' +
                '</figure>' +
                '</div>' +
                '</article>';
        }
        $('#tab_' + roomname + ' .comment-list').append(html_content);
        $('#tab_' + roomname + ' .comment-list').children().last().parseEmotion();
        $('#tab_' + roomname + ' .comment-list').animate({
            scrollTop: $('#tab_' + roomname + ' .comment-list')[0].scrollHeight
        }, duration);
        if (unread) { //更新一下小红点
            count = $('#tab_' + roomname + ' article[data-unread="1"]').length;
            count = count < 100 ? count : '99+';
            $('a[href="#tab_' + roomname + '"] .badge').text(count);
            $('a[href="#tab_' + roomname + '"] .badge').show();
        }
    }
    
    /**
     * 检测IE版本 
     */
    function detectIE() {
            var version = false;
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
       if (msie > 0) {
            // IE 10 or older
            version = parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
       if (trident > 0) {
            // IE 11 
            var rv = ua.indexOf('rv:');
            version = parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
           // IE 12 
           version = parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }
 
        if (version !== false && version < 11) {
                var warning_url = location.href + 'IE.html';
            window.location.replace(warning_url);
        }
    }
    
    /**
     * 恢复标题
     */
    $(window).focus(function () {
            $("title").text("Welcome To Bubble Chat Room !");
    });
});