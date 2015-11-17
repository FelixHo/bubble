<?php

class Robot
{
    
    /*API 返回CODE字段类型标识*/
    const TEXT_TYPE_CODE = 100000; //文本类
    
    const URL_TYPE_CODE = 200000; //网址类
    
    const NEWS_TYPE_CODE = 302000; //新闻
    
    const APP_TYPE_CODE = 304000; //应用、软件下载 forbid
    
    const TRAIN_TYPE_CODE = 305000; //列车 
    
    const FLIGHT_TYPE_CODE = 306000; //航班 forbid
    
    const INFO_TYPE_CODE = 308000; //菜谱、视频
    
    const HOTEL_TYPE_CODE = 309000; //酒店 
    
    const PRICE_TYPE_CODE = 311000; //价格 forbid
    
    const RESTAURANT_TYPE_CODE = 312000; //餐厅
    
    /*机器人配置*/
    const ROBOT_API_URL = "http://www.tuling123.com/openapi/api";
    
    const ROBOT_API_KEY = "e1de45112fb01196cf4c41d6ba76bc8f";
    
    /*API 返回CODE字段错误标识*/
    private $code_list = array('40001' => 'key的长度错误（32位）', '40002' => '请求内容为空', '40003' => 'key错误或帐号未激活', '40004' => '当天请求次数已用完', '40005' => '暂不支持该功能', '40006' => '服务器升级中', '40007' => '服务器数据格式异常', '50000' => '机器人设定的“学用户说话”或者“默认回答”');
    
    function chat($message)
    {
        $url           = self::ROBOT_API_URL;
        $param['key']  = self::ROBOT_API_KEY;
        $param['info'] = $message;
        $data          = $this->http($url, $param);
        $data          = json_decode($data, true);
        $result        = NULL;
        
        switch ($data['code']) {
            case self::TEXT_TYPE_CODE: {
                $result = $data['text'];
                break;
            }
            case self::URL_TYPE_CODE: {
                
                $result = $data['text'] . "\n" . $this->urlWrapper($data['url'], '点击查看');
                break;
            }
            case self::NEWS_TYPE_CODE: {
                $news = '';
                foreach ($data['list'] as $item) {
                    if ($item['article'] && $item['source']) {
                        $news .= $this->mediaWrapper($item['icon'], $item['article'], '来自:' . $item['source'], '新闻', $item['detailurl']);
                    }
                }
                if ($news) {
                    $result = $this->contentWrapper($news);
                } else {
                    $result = '木有找到相关新闻(- -!)';
                }
                break;
            }
            case self::TRAIN_TYPE_CODE: {
                
                $trains = '';
                foreach ($data['list'] as $item) {
                    $icon  = $item['icon'];
                    $title = $item['start'] . ' ~ ' . $item['terminal'];
                    $desc  = $item['trainnum'] . ' | ' . $item['starttime'] . ' ~ ' . $item['endtime'];
                    $cat   = '列车';
                    $link  = $item['detailurl'];
                    $trains .= $this->mediaWrapper($icon, $title, $desc, $cat, $link);
                }
                if ($trains) {
                    $result = $this->contentWrapper($trains);
                } else {
                    $result = '木有找到相关列车信息(- -!)';
                }
                break;
            }
            case self::INFO_TYPE_CODE: {
                
                $infos = '';
                foreach ($data['list'] as $item) {
                    //[标题，说明，全文连接，图片链接]
                    $cat = strpos($data['text'], '菜谱') !== false ? '菜谱' : '资讯';
                    $infos .= $this->mediaWrapper($item['icon'], $item['name'], $item['info'], $cat, $item['detailurl']);
                }
                if ($infos) {
                    $result = $this->contentWrapper($infos);
                } else {
                    $result = '木有找到相关内容(- -!)';
                }
                break;
            }
            default: {
                
                if ($this->code_list[$data['code']]) {
                    $result = $this->code_list[$data['code']];
                } else {
                    $r = array(
                        '唔知道!',
                        '额...不是很懂你说啥',
                        '听不懂..',
                        '不要乱说话!!!',
                        'Zzzzzz..~~',
                        '可以讲人话?',
                        '你的语文是门卫教的吗...'
                    );
                    shuffle($r);
                    $result = $r[0];
                }
            }
        }
        return $result;
    }
    
    /**
     * 组装url以及文本信息，返回a标签字符串
     * @param $url
     * @param $content
     */
    private function urlWrapper($url, $content)
    {
        $url    = str_replace("m.toutiao.com", "toutiao.com", $url);
        $format = '<a href="%s" target="_blank">%s</a>';
        return sprintf($format, $url, $content);
    }
    
    /**
     * 组装媒体信息
     * @param $icon
     * @param $title
     * @param $desc
     * @param $cat
     */
    private function mediaWrapper($icon, $title, $desc, $cat, $link)
    {
        $imgcl   = $icon ? '' : 'hidden';
        $content = "
        <li data-link='{$link}' class='media'>
            <padebar>
                <span>{$cat}</span>
            </padebar>
            <img src='{$icon}' class='{$imgcl}'/>
            <div class='info'>
                <h2 class='title'>{$title}</h2>
                <p class='desc'>{$desc}</p>
            </div>
        </li>";
        return $content;
    }
    
    /**
     * 内容封装
     * @param $content
     */
    private function contentWrapper($content)
    {
        return '<ul class="event-list">' . $content . '</ul>';
    }
    /**
     * 发送HTTP请求方法，目前只支持CURL发送请求
     * @param  string $url    请求URL
     * @param  array  $param  GET参数数组
     * @param  array  $data   POST的数据，GET请求时该参数无效
     * @param  string $method 请求方法GET/POST
     * @return array          响应数据
     */
    protected static function http($url, $param, $data = '', $method = 'GET')
    {
        $opts = array(
            CURLOPT_TIMEOUT => 30,
            CURLOPT_RETURNTRANSFER => 1,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        );
        
        /* 根据请求类型设置特定参数 */
        $opts[CURLOPT_URL] = $url . '?' . http_build_query($param);
        
        if (strtoupper($method) == 'POST') {
            $opts[CURLOPT_POST]       = 1;
            $opts[CURLOPT_POSTFIELDS] = $data;
            
            if (is_string($data)) { //发送JSON数据
                $opts[CURLOPT_HTTPHEADER] = array(
                    'Content-Type: application/json; charset=utf-8',
                    'Content-Length: ' . strlen($data)
                );
            }
        }
        
        /* 初始化并执行curl请求 */
        $ch = curl_init();
        curl_setopt_array($ch, $opts);
        $data  = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);
        
        //发生错误，抛出异常
        if ($error)
            throw new \Exception('请求发生错误：' . $error);
        return $data;
    }
}
