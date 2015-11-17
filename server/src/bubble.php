<?php
/**
 * Bubble Websocket服务端
 */
date_default_timezone_set("asia/shanghai");

require '../util/db.php';
require '../util/robot.php';

define('SUCCESS_CODE', 200);
define('INVALID_CODE', -101);
define('ERROR_CODE', 404);
define('FORBID_CODE', 403);
define('USERNAME_MAXLEN', 6);
define('CONTENT_MAXLEN', 500);

//创建websocket服务器对象，监听127.0.0.1:9009端口
$ws    = new swoole_websocket_server("127.0.0.1", 9009);

//机器人类
$robot = new Robot();
//在线用户详情记录
$table = new swoole_table(1024 * 10);
$table->column('name', swoole_table::TYPE_STRING, 16);
$table->column('fd', swoole_table::TYPE_INT);
$table->column('dateline', swoole_table::TYPE_INT);
$table->column('avatar', swoole_table::TYPE_INT);
$table->column('ip', swoole_table::TYPE_STRING, 16);
$table->create();
$ws->table_user = $table;

$ws->on('open', function($ws, $request)
{
    $ws->push($request->fd, jsonResult('open', SUCCESS_CODE, "连接成功!\n"));
});

$frames_data = array();
$ws->on('message', function($ws, $frame)
{
    global $robot, $frames_data;
    $frames_data[$frame->fd] = isset($frames_data[$frame->fd]) ? $frames_data[$frame->fd] : '';
    $frames_data[$frame->fd] .= $frame->data;

    if ($frame->finish){
        $json = $frames_data[$frame->fd];
        $msg = json_decode($json, true);    
        unset($frames_data[$frame->fd]);

        if (JSON_ERROR_NONE == json_last_error()) {
            $act = $msg['action'];
            switch ($act) {
                case 'login': //用户登录
                    $username = $msg['username'];
                    
                    if ($ws->table_user->exist($username)) {
                        $usr = $ws->table_user->get($username);
                        if ($usr['ip'] == $msg['ip']) {
                            $ws->push($frame->fd, jsonResult($act, FORBID_CODE, "你已经以用户名 “{$username}” 在其他窗口登录, 请关闭本窗口")); // 相同浏览器不允许重复登录相同用户
                        } else {
                            $ws->push($frame->fd, jsonResult($act, INVALID_CODE, "用户名 “{$username}” 已存在")); // 已存在  
                        }
                    } elseif (mb_strlen($username, 'utf8') > USERNAME_MAXLEN) {
                        $ws->push($frame->fd, jsonResult($act, INVALID_CODE, "非法用户名")); // 用户名过长
                    } else {
                        $avatar = get_avatar_number($username);
                        $ws->table_user->set($username, array(
                            'name' => $username,
                            'fd' => $frame->fd,
                            'dateline' => time(),
                            'avatar' => $avatar,
                            'ip' => $msg['ip']
                        ));
                        $ol   = get_online_lsit($ws, $frame->fd);
                        //登录成功
                        $data = array(
                            'username' => $username,
                            'avatar' => $avatar,
                            'online' => $ol
                        );
                        $ws->push($frame->fd, jsonResult($act, SUCCESS_CODE, 'success', $data));
                        //广播通知上线提示
                        $data = array(
                            'username' => $username,
                            'avatar' => $avatar
                        );
                        broadcast($ws, $frame->fd, 'online', SUCCESS_CODE, "{$username} 已经上线", $data);
                        logger("{$username} 已经上线");
                        //初始化群聊记录
                        $db  = new db();
                        $log = $db->select_latest_group_chat_log(30);
                        $ws->push($frame->fd, jsonResult('init', SUCCESS_CODE, 'success', $log));
                    }
                    
                    break;
                
                case 'chat': //聊天行为
                    $category = $msg['category'];
                    $date     = date('Y年m月d日 H:i:s');
                    $from     = $msg['from'];
                    $usr      = get_valid_usr($ws, $from, $frame->fd);
                    $media    = $msg['media'];
                    
                    if (empty($from) || empty($usr)) {
                        $ws->push($frame->fd, jsonResult('error', ERROR_CODE, '用户名信息异常，请刷新页面!'));
                        break;
                    } elseif (strlen($msg['content'])>=2*1024*1024) {
                            $ws->push($frame->fd, jsonResult('error', ERROR_CODE, '内容大小超出最大限制(2MB)'));
                        break;
                    }
                    
                    $content = $media ? $msg['content'] : content_filter($msg['content']);
                    $avatar  = get_avatar_number($from);
                    $to      = $msg['to'];
                    
                    if ($category == 'robot') {
                        //发送成功
                        $data = array(
                            'username' => $from,
                            'avatar' => $avatar,
                            'time' => $date,
                            'content' => $content,
                            'room' => $to,
                            'room_icon' => get_avatar_number($to),
                            'media' => $media
                        );
                        $ws->push($frame->fd, jsonResult($act, SUCCESS_CODE, 'success', $data));
                        //访问机器人
                        if ($media) {
                                $content = '好看吗';
                        }
                        $result = $robot->chat($content);
                        $date   = date('Y年m月d日 H:i:s');
                        $data   = array(
                            'username' => $to,
                            'avatar' => get_avatar_number($to),
                            'time' => $date,
                            'content' => $result,
                            'room' => $to,
                            'room_icon' => get_avatar_number($to),
                            'media' => 0
                        );
                        //机器人应答
                        $ws->push($frame->fd, jsonResult($act, SUCCESS_CODE, 'success', $data));
                        
                    } elseif ($category == 'public') {
                        $db = new db();
                        
                        if($media==1){//出于对服务器安全考虑，不存储图片数据
                            $save_content = '[图片] (出于安全原因，群聊图片不作永久保存)';
                        } else {
                            $save_content = $content;
                        }
                        $db->insert_group_chat_log(array(
                                'username' => $from,
                                'avatar' => $avatar,
                            'time' => $date,
                                'content' => $save_content,
                                'media' => 0
                            ));
                        
                        $data = array(
                            'username' => $from,
                            'avatar' => $avatar,
                            'time' => $date,
                            'content' => $content,
                            'room' => $to,
                            'room_icon' => get_avatar_number($to),
                            'media' => $media
                        );
                        //广播群聊消息
                        broadcast($ws, $frame->fd, $act, SUCCESS_CODE, 'success', $data, true);
                    } elseif ($category == 'private') {
                        $to_fd = get_fd_by_name($ws, $to);
                        if ($to_fd === null) { //用户不存在或已下线
                            $ws->push($frame->fd, jsonResult($act, INVALID_CODE, '用户不存在或已下线!'));
                        } else {
                            //发送成功
                            $data = array(
                                'username' => $from,
                                'avatar' => $avatar,
                                'time' => $date,
                                'content' => $content,
                                'room' => $to,
                                'room_icon' => get_avatar_number($to),
                                'media' => $media
                            );
                            $ws->push($frame->fd, jsonResult($act, SUCCESS_CODE, 'success', $data));
                            //发送到私聊用户
                            $data = array(
                                'username' => $from,
                                'avatar' => $avatar,
                                'time' => $date,
                                'content' => $content,
                                'room' => $from,
                                'room_icon' => get_avatar_number($from),
                                'media' => $media
                            );
                            $ws->push($to_fd, jsonResult($act, SUCCESS_CODE, 'success', $data));
                        }
                    }
                    
                    break;
                
                default:
                    # code...
                    break;
            }
            
        } else {
                var_export($frame->data);
            $ws->push($frame->fd, jsonResult('error', FORBID_CODE, '非法参数请求!'));
        }
    }
});

$ws->on('close', function($ws, $fd) //用户断开连接
{
    $usr = get_usr_by_fd($ws, $fd);
    if (!empty($usr)) {
        $ws->table_user->del($usr['name']);
        $data = array(
            'username' => $usr['name'],
            'avatar' => $usr['avatar']
        );
        //广播离线提示
        broadcast($ws, $fd, 'offline', SUCCESS_CODE, "{$usr['name']} 已经下线", $data);
        logger("{$usr['name']} 已经下线");
    }
});

$ws->start();

/**
 * json格式化返回结果
 * @param $action
 * @param int $code
 * @param string $info
 * @param string $data
 * @return string
 */
function jsonResult($action, $code = SUCCESS_CODE, $info = '', $data = '')
{
    $ret = array(
        'action' => $action,
        'data' => $data,
        'info' => $info,
        'code' => $code
    );
    return json_encode($ret);
}

/**
 * generate the avatar id by username
 * @param $username
 * @return int|string
 */
function get_avatar_number($username)
{
    if ($username == 'grouproom') {
        return 'group';
    } elseif ($username == 'Bubble机器人') {
        return 'robot';
    }
    $arr = str_split(md5($username));
    $sum = 0;
    foreach ($arr as $value) {
        $sum += ord($value);
    }
    return $sum % 30;
}

/**
 * 广播信息到所有用户
 * @param $ws
 * @param $from_fd
 * @param $action
 * @param int $code
 * @param string $info
 * @param string $data
 * @param bool $all
 */
function broadcast($ws, $from_fd, $action, $code = SUCCESS_CODE, $info = '', $data = '', $all = false)
{
    foreach ($ws->connections as $fd) {
        if (!$all && $fd == $from_fd) {
            continue;
        }
        $ws->push($fd, jsonResult($action, $code, $info, $data));
    }
}

/**
 * 获取在线用户信息
 * @param $ws
 * @param null $req_fd
 * @return array
 */
function get_online_lsit($ws, $req_fd = null)
{
    $list = array();
    
    foreach ($ws->table_user as $row) {
        if ($req_fd !== null && $row['fd'] == $req_fd) {
            continue;
        } else {
            $list[] = array(
                'username' => $row['name'],
                'avatar' => $row['avatar']
            );
        }
    }
    return $list;
}

/**
 * 通过用户名获取fd
 * @param $ws
 * @param $name
 * @return
 */
function get_fd_by_name($ws, $name)
{
    $fd = null;
    if ($ws->table_user->exist($name)) {
        $usr = $ws->table_user->get($name);
        $fd  = $usr['fd'];
    }
    return $fd;
}

/**
 * 通过fd获取用户名信息
 * @param $ws
 * @param $fd
 * @return string
 */
function get_name_by_fd($ws, $fd)
{
    $username = '';
    foreach ($ws->table_user as $row) {
        if ($row['fd'] == $fd) {
            $username = $row['name'];
        }
    }
    return $username;
}

/**
 * 过滤超长文本
 * @param $content
 * @return string
 */
function content_filter($content)
{
    $content = htmlspecialchars($content, ENT_QUOTES, 'UTF-8');
    if (mb_strlen($content, 'utf8') > CONTENT_MAXLEN) {
        $content = mb_substr($content, 0, CONTENT_MAXLEN, 'utf8') . '...';
    }
    return $content;
}

/**
 * 判断username和fd是否匹配
 * @param $ws
 * @param $username
 * @param $fd
 * @return bool
 */
function get_valid_usr($ws, $username, $fd)
{
    $usr = $ws->table_user->get($username);
    if ($usr['name'] == $username && $usr['fd'] == $fd) {
        return $usr;
    } else {
        return false;
    }
}

/**
 * 通过fd来获取usr
 * @param $ws
 * @param $fd
 * @return
 */
function get_usr_by_fd($ws, $fd)
{
    $usr = null;
    foreach ($ws->table_user as $row) {
        if ($row['fd'] == $fd) {
            $usr = $row;
        }
    }
    return $usr;
}

/**
 * 打印类
 * @param $msg
 */
function logger($msg)
{
    echo date('Y-m-d H:i:s') . '|' . $msg . PHP_EOL;
}
