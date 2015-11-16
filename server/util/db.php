<?php
require '../lib/medoo.php';

/**
 * 数据操作类
 * Class db
 */
class db
{
    const GP_CHAT_LOG_TB = 'group_chat_log';
    
    private $config = array();
    
    private $mysql = null;
    
    /**
     * 初始化db配置
     */
    public function __construct()
    {
        $this->config = array(
            'database_type' => 'mysql',
            'database_name' => 'bubble',
            'server' => '127.0.0.1',
            'username' => 'bubble',
            'password' => 'bubble',
            'charset' => 'utf8',
            'port' => 3306,
            'prefix' => 'bb_'
        );
        $this->mysql  = new medoo($this->config);
    }
    
    /**
     * 插入群聊记录
     * @param $data
     */
    public function insert_group_chat_log($data)
    {
        $this->mysql->insert(self::GP_CHAT_LOG_TB, $data);
    }
    
    /**
     * 查询最新的群里记录
     * @param $limit
     * @return array|bool
     */
    public function select_latest_group_chat_log($limit)
    {
        $result = $this->mysql->select(self::GP_CHAT_LOG_TB, array(
            'username',
            'avatar',
            'content',
            'time',
            'media'
        ), array(
            'ORDER' => 'id DESC',
            'LIMIT' => $limit
        ));
        $result = array_reverse($result);
        return $result;
    }
}