var SERVER = {
    IP : process.env.baseUrl
}

var notificationMessages = {
    constituencyEmail: {
        emailSubject: "Constituency Email",
        email: "Hi, <br> {{message}} <br><br><br><br>Regards,<br>{{name}},<br>{{email}}"
    },
    commmon: {
        email: `
        <!doctype html>
        <html style="height:100%;">
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                <meta name="viewport" content="width=device-width"/>
                <title>Forgot Password </title>
            </head>
        
            <body style="margin:0px; padding:0px; height:100%;">
                <table style="vertical-align:top; font-family:Arial, Helvetica, sans-serif; color:#000; background:#e8e8e8; font-size:14px;" width="100%" height="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td>
                            <table style="max-width:650px; margin:0 auto;padding:0;box-sizing:border-box; margin-top:50px; margin-bottom:50px;">
                                <tr>
                                    <td>
                                        <table style="background:#ececec;width:100%; padding: 0px 0px 0px 0px; box-sizing:border-box;border: 5px solid; border-color: #4326a7;">
                                            <tr>
                                                <td><h2 style="margin:0px;padding:20px; text-align:center"><img src="`+SERVER.IP+`/images/new_astro_logo.png" width="200" height="100"/></h2></td>
                                            </tr>                                            
                                        </table>
                                        <table style="padding:20px; background:#ececec;width:100%; box-sizing:border-box;border: 5px solid; border-color: #4326a7;border-top: 5px">
                                            
                                            <tr>
                                                <td style="margin:0px;"><h2 style="font-size:20px;font-weight:600; margin:5px 0;text-align:center; color:#000;text-shadow: 1px 1px 1px #fff;"> Hello, {{name}}</h2> </td>
                                            </tr>
        
                                            <tr>
                                                <td style="margin:0px;text-align:center;padding-top: 15px;padding-right: 0px;padding-bottom: 0px;padding-left: 0px; letter-spacing:1px; font-size:16px;color:#333;">
                                                    <p style="letter-spacing:1px; font-size:16px;color:#333;"> {{message1}}</p>
                                                    <p style="letter-spacing:1px; font-size:16px;color:#333;"> {{message2}}</p>
                                                </td>
                                            </tr>
                                        </table>
                                        <table style="padding:30px; width:100%; box-sizing:border-box;border: 5px solid; border-color: #4326a7;border-top: 5px;background: #4326a7;">
                                            <tr>
                                                <td style="margin:0px; padding:0px; text-align:center;">
                                                    <h3 style="margin:0px; color:#fff; font-size:18px;margin-bottom:5px;">Astrowize Support Team</h3>
                                                    <p style=" font-size:16px;color:#fff; margin:0px; letter-spacing:1px;"> &copy; 2020 Astrowize</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
        </html>`
    },
    common_button: {
        email: `
        <!doctype html>
        <html style="height:100%;">
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                <meta name="viewport" content="width=device-width"/>
                <title>Forgot Password </title>
            </head>
        
            <body style="margin:0px; padding:0px; height:100%;">
                <table style="vertical-align:top; font-family:Arial, Helvetica, sans-serif; color:#000; background:#e8e8e8; font-size:14px;" width="100%" height="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td>
                            <table style="max-width:650px; margin:0 auto;padding:0;box-sizing:border-box; margin-top:50px; margin-bottom:50px;">
                                <tr>
                                    <td>
                                        <table style="background:#ececec;width:100%; padding: 0px 0px 0px 0px; box-sizing:border-box;border: 5px solid; border-color: #4326a7;">
                                            <tr>
                                                <td><h2 style="margin:0px;padding:20px; text-align:center"><img src="`+SERVER.IP+`/images/new_astro_logo.png" width="200" height="100"/></h2></td>
                                            </tr>                                            
                                        </table>
                                        <table style="padding:20px; background:#ececec;width:100%; box-sizing:border-box;border: 5px solid; border-color: #4326a7;border-top: 5px">
                                            
                                            <tr>
                                                <td style="margin:0px;"><h2 style="font-size:20px;font-weight:600; margin:5px 0;text-align:center; color:#000;text-shadow: 1px 1px 1px #fff;"> Hello, {{name}}</h2> </td>
                                            </tr>
        
                                            <tr>
                                                <td style="margin:0px;text-align:center;padding-top: 15px;padding-right: 0px;padding-bottom: 0px;padding-left: 0px; letter-spacing:1px; font-size:16px;color:#333;">
                                                    <p style="letter-spacing:1px; font-size:16px;color:#333;"> {{message1}}</p>
                                                    <p style="letter-spacing:1px; font-size:16px;color:#333;"> {{message2}}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="text-align:center; padding:15px 0px;"><a href="{{button_link}}" style="width:40%;line-height:18px; padding:20px; display:inline-block; background:#d90368;text-decoration:none;font-size: 15px;font-weight: 600; letter-spacing: 1px;color:#fff;border-radius:8px; text-transform:uppercase;box-shadow: 0px 2px 3px #d90368;">Download</a>
                                                </td>
                                            </tr>
                                        </table>
                                        <table style="padding:30px; width:100%; box-sizing:border-box;border: 5px solid; border-color: #4326a7;border-top: 5px;background: #4326a7;">
                                            <tr>
                                                <td style="margin:0px; padding:0px; text-align:center;">
                                                    <h3 style="margin:0px; color:#fff; font-size:18px;margin-bottom:5px;">Astrowize Support Team</h3>
                                                    <p style=" font-size:16px;color:#fff; margin:0px; letter-spacing:1px;"> &copy; 2020 Astrowize</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
        </html>`
    },
};

var APP_CONSTANTS = {
    SERVER: SERVER,
    notificationMessages: notificationMessages
};

module.exports = APP_CONSTANTS;