/* 
 Javascript Terminal

 Copyright (c) 2011 Fabrice Bellard

 Redistribution or commercial use is prohibited without the author's
 permission.
 */
"use strict";


function jslinux_str2utf8(string) {
    var utftext = "";
    var n;
    var c;

    for (n = 0; n < string.length; n++) {

        c = string.charCodeAt(n);

        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if ((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }

    return utftext;
}


function jslinux_utf82str(utftext) {
    var string = "";
    var i = 0;
    var c = 0;
    var c1 = 0;
    var c2 = 0;
    var c3 = 0;

    while (i < utftext.length) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        }
        else if ((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i + 1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        }
        else {
            c2 = utftext.charCodeAt(i + 1);
            c3 = utftext.charCodeAt(i + 2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }

    }
    return string;
}

function Term(width, height, handler) {
    this.w = width;
    this.h = height;
    this.cur_h = height;
    this.tot_h = 1000;
    this.y_base = 0;
    this.y_disp = 0;
    this.x = 0;
    this.y = 0;
    this.cursorstate = 0;
    this.handler = handler;
    this.convert_lf_to_crlf = false;
    this.state = 0;
    this.output_queue = "";
    this.bg_colors = ["#000000", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff"];
    this.fg_colors = ["#000000", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff"];
    this.def_attr = (7 << 3) | 0;
    this.cur_attr = this.def_attr;
    this.is_mac = (navigator.userAgent.indexOf("Mac") >= 0) ? true : false;
    this.key_rep_state = 0;
    this.key_rep_str = "";
    this.tlines = [];
}
Term.prototype.open = function (container) {
    var y, line, i, _this, c, table, td_element, tr_element;
    this.lines = [];
    c = 32 | (this.def_attr << 16);
    for (y = 0; y < this.cur_h; y++) {
        line = [];
        for (i = 0; i < this.w; i++) {
            line[i] = c;
        }
        this.lines[y] = line;
    }

    // TODO: jquery equivalents (!)

    table = document.createElement('table');
    table.border = 0;
    table.cellSpacing = 0;
    table.cellPadding = 0;
    for (y = 0; y < this.h; y++) {
        tr_element = document.createElement('tr');
        td_element = document.createElement('td');
        td_element.className = 'term';
        this.tlines[y] = td_element;
        tr_element.appendChild(td_element);
        table.appendChild(tr_element);
    }
    this.refresh(0, this.h - 1);
    _this = this;

    // TODO: prototype.close(), that should delete this interval, remove keydown, keypress events listeners
    setInterval(function () {
        _this.cursor_timer_cb();
    }, 1000);

    var keydown_handler = _this.keyDownHandler.bind(_this);
    var keypress_handler = _this.keyPressHandler.bind(_this);

    //TODO: switch class instead of direct setting !
    table.style.border = "10px solid black";

    var capture_keyboard = function () {
        table.style.border = "10px solid red";
        document.addEventListener("keydown", keydown_handler);
        document.addEventListener("keypress", keypress_handler);
    };

    var uncapture_keyboard = function () {
        table.style.border = "10px solid black";
        document.removeEventListener('keydown', keydown_handler);
        document.removeEventListener('keypress', keypress_handler);
    };

    var handleMouseEnter = function (handler) {
        return function (e) {
            e = e || event; // IE
            var toElement = e.relatedTarget || e.srcElement; // IE

            // проверяем, мышь пришла с элемента внутри текущего?
            while (toElement && toElement !== this) {
                toElement = toElement.parentNode;
            }

            if (toElement == this) { // да, мышь перешла изнутри родителя
                return; // мы перешли на родителя из потомка, лишнее событие
            }

            return handler.call(this, e);
        };
    };

    var handleMouseLeave = function (handler) {

        return function (e) {
            e = e || event; // IE
            var toElement = e.relatedTarget || e.toElement; // IE

            // проверяем, мышь ушла на элемент внутри текущего?
            while (toElement && toElement !== this) {
                toElement = toElement.parentNode;
            }

            if (toElement == this) { // да, мы всё еще внутри родителя
                return; // мы перешли с родителя на потомка, лишнее событие
            }

            return handler.call(this, e);
        };
    };

    table.onmouseover = handleMouseEnter(capture_keyboard);
    table.onmouseout = handleMouseLeave(uncapture_keyboard);

    if (container.appendChild) {
        container.appendChild(table);
    } else {
        //jquery version
        container.append(table);
    }
};


Term.prototype.refresh = function (fa, ga) {
    var y, character_line_string, inner_html, character_code, width, i, ja, attr, def_attr, fg_color_index, bg_color_index, line_number;
    for (y = fa; y <= ga; y++) {
        line_number = y + this.y_disp;
        if (line_number >= this.cur_h)
            line_number -= this.cur_h;
        character_line_string = this.lines[line_number];
        inner_html = "";
        width = this.w;
        if (y == this.y && this.cursor_state && this.y_disp == this.y_base) {
            ja = this.x;
        } else {
            ja = -1;
        }
        def_attr = this.def_attr;
        for (i = 0; i < width; i++) {
            character_code = character_line_string[i];
            attr = character_code >> 16;
            character_code &= 0xffff;
            if (i == ja) {
                attr = -1;
            }
            if (attr != def_attr) {
                if (def_attr != this.def_attr)
                    inner_html += '</span>';
                if (attr != this.def_attr) {
                    if (attr == -1) {
                        inner_html += '<span class="termReverse">';
                    } else {
                        inner_html += '<span style="';
                        fg_color_index = (attr >> 3) & 7;
                        bg_color_index = attr & 7;
                        if (fg_color_index != 7) {
                            inner_html += 'color:' + this.fg_colors[fg_color_index] + ';';
                        }
                        if (bg_color_index != 0) {
                            inner_html += 'background-color:' + this.bg_colors[bg_color_index] + ';';
                        }
                        inner_html += '">';
                    }
                }
            }
            switch (character_code) {
                case 32:
                    inner_html += "&nbsp;";
                    break;
                case 38:
                    inner_html += "&amp;";
                    break;
                case 60:
                    inner_html += "&lt;";
                    break;
                case 62:
                    inner_html += "&gt;";
                    break;
                default:
                    if (character_code < 32) {
                        inner_html += "&nbsp;";
                    } else {
                        inner_html += String.fromCharCode(character_code);
                    }
                    break;
            }
            def_attr = attr;
        }
        if (def_attr != this.def_attr) {
            inner_html += '</span>';
        }
        this.tlines[y].innerHTML = jslinux_utf82str(inner_html);
    }
};
Term.prototype.cursor_timer_cb = function () {
    this.cursor_state ^= 1;
    this.refresh(this.y, this.y);
};
Term.prototype.show_cursor = function () {
    if (!this.cursor_state) {
        this.cursor_state = 1;
        this.refresh(this.y, this.y);
    }
};
Term.prototype.scroll = function () {
    var line_char_values, x, character_code, line_index;
    if (this.cur_h < this.tot_h) {
        this.cur_h++;
    }
    if (++this.y_base == this.cur_h)this.y_base = 0;
    this.y_disp = this.y_base;
    character_code = 32 | (this.def_attr << 16);
    line_char_values = [];
    for (x = 0; x < this.w; x++)
        line_char_values[x] = character_code;
    line_index = this.y_base + this.h - 1;
    if (line_index >= this.cur_h)
        line_index -= this.cur_h;
    this.lines[line_index] = line_char_values;
};
Term.prototype.scroll_disp = function (n) {
    var i, oa;
    if (n >= 0) {
        for (i = 0; i < n; i++) {
            if (this.y_disp == this.y_base)break;
            if (++this.y_disp == this.cur_h)this.y_disp = 0;
        }
    } else {
        n = -n;
        oa = this.y_base + this.h;
        if (oa >= this.cur_h)
            oa -= this.cur_h;
        for (i = 0; i < n; i++) {
            if (this.y_disp == oa)
                break;
            if (--this.y_disp < 0)
                this.y_disp = this.cur_h - 1;
        }
    }
    this.refresh(0, this.h - 1);
};
Term.prototype.write = function (pa) {
    function qa(y) {
        fa = Math.min(fa, y);
        ga = Math.max(ga, y);
    }

    function ra(s, x, y) {
        var l, i, c, oa;
        oa = s.y_base + y;
        if (oa >= s.cur_h)oa -= s.cur_h;
        l = s.lines[oa];
        c = 32 | (s.def_attr << 16);
        for (i = x; i < s.w; i++)l[i] = c;
        qa(y);
    }

    function sa(s, ta) {
        var j, n;
        if (ta.length == 0) {
            s.cur_attr = s.def_attr;
        } else {
            for (j = 0; j < ta.length; j++) {
                n = ta[j];
                if (n >= 30 && n <= 37) {
                    s.cur_attr = (s.cur_attr & ~(7 << 3)) | ((n - 30) << 3);
                } else if (n >= 40 && n <= 47) {
                    s.cur_attr = (s.cur_attr & ~7) | (n - 40);
                } else if (n == 0) {
                    s.cur_attr = s.def_attr;
                }
            }
        }
    }

    var ua = 0;
    var va = 1;
    var wa = 2;
    var i, c, fa, ga, n, j, oa;
    fa = this.h;
    ga = -1;
    qa(this.y);
    if (this.y_base != this.y_disp) {
        this.y_disp = this.y_base;
        fa = 0;
        ga = this.h - 1;
    }
    for (i = 0; i < pa.length; i++) {
        c = pa.charCodeAt(i);
        switch (this.state) {
            case ua:
                switch (c) {
                    case 10:
                        if (this.convert_lf_to_crlf) {
                            this.x = 0;
                        }
                        this.y++;
                        if (this.y >= this.h) {
                            this.y--;
                            this.scroll();
                            fa = 0;
                            ga = this.h - 1;
                        }
                        break;
                    case 13:
                        this.x = 0;
                        break;
                    case 8:
                        if (this.x > 0) {
                            this.x--;
                        }
                        break;
                    case 9:
                        n = (this.x + 8) & ~7;
                        if (n <= this.w) {
                            this.x = n;
                        }
                        break;
                    case 27:
                        this.state = va;
                        break;
                    default:
                        if (c >= 32) {
                            if (this.x >= this.w) {
                                this.x = 0;
                                this.y++;
                                if (this.y >= this.h) {
                                    this.y--;
                                    this.scroll();
                                    fa = 0;
                                    ga = this.h - 1;
                                }
                            }
                            oa = this.y + this.y_base;
                            if (oa >= this.cur_h)oa -= this.cur_h;
                            this.lines[oa][this.x] = (c & 0xffff) | (this.cur_attr << 16);
                            this.x++;
                            qa(this.y);
                        }
                        break;
                }
                break;
            case va:
                if (c == 91) {
                    this.esc_params = [];
                    this.cur_param = 0;
                    this.state = wa;
                } else {
                    this.state = ua;
                }
                break;
            case wa:
                if (c >= 48 && c <= 57) {
                    this.cur_param = this.cur_param * 10 + c - 48;
                } else {
                    this.esc_params[this.esc_params.length] = this.cur_param;
                    this.cur_param = 0;
                    if (c == 59)break;
                    this.state = ua;
                    switch (c) {
                        case 65:
                            n = this.esc_params[0];
                            if (n < 1)n = 1;
                            this.y -= n;
                            if (this.y < 0)
                                this.y = 0;
                            break;
                        case 66:
                            n = this.esc_params[0];
                            if (n < 1)n = 1;
                            this.y += n;
                            if (this.y >= this.h)
                                this.y = this.h - 1;
                            break;
                        case 67:
                            n = this.esc_params[0];
                            if (n < 1)
                                n = 1;
                            this.x += n;
                            if (this.x >= this.w - 1)
                                this.x = this.w - 1;
                            break;
                        case 68:
                            n = this.esc_params[0];
                            if (n < 1)n = 1;
                            this.x -= n;
                            if (this.x < 0)
                                this.x = 0;
                            break;
                        case 72:
                        {
                            var xa, oa1;
                            oa1 = this.esc_params[0] - 1;
                            if (this.esc_params.length >= 2)
                                xa = this.esc_params[1] - 1;
                            else
                                xa = 0;
                            if (oa1 < 0)
                                oa1 = 0;
                            else if (oa1 >= this.h)
                                oa1 = this.h - 1;
                            if (xa < 0)
                                xa = 0;
                            else if (xa >= this.w)
                                xa = this.w - 1;
                            this.x = xa;
                            this.y = oa1;
                        }
                            break;
                        case 74:
                            ra(this, this.x, this.y);
                            for (j = this.y + 1; j < this.h; j++)
                                ra(this, 0, j);
                            break;
                        case 75:
                            ra(this, this.x, this.y);
                            break;
                        case 109:
                            sa(this, this.esc_params);
                            break;
                        case 110:
                            this.queue_chars("\x1b[" + (this.y + 1) + ";" + (this.x + 1) + "R");
                            break;
                        default:
                            break;
                    }
                }
                break;
        }
    }
    qa(this.y);
    if (ga >= fa)
        this.refresh(fa, ga);
};
Term.prototype.writeln = function (pa) {
    this.write(pa + '\r\n');
};

// http://stackoverflow.com/questions/7295508/javascript-capture-browser-shortcuts-ctrlt-n-w
// http://www.javascripter.net/faq/keycodes.htm

Term.prototype.keyDownHandler = function (event) {
    var str;
    str = "";
    switch (event.keyCode) {
        case 8: // backspace
            str = "\x7f";
            break;
        case 9: //tab
            str = "\t";
            break;
        case 13: //enter
            str = "\r";
            break;
        case 27: //Esc
            str = "\x1b";
            break;
        case 37: // <-
            str = "\x1b[D";
            break;
        case 39: // ->
            str = "\x1b[C";
            break;
        case 38: // ^
            if (event.ctrlKey) {
                this.scroll_disp(-1);
            } else {
                str = "\x1b[A";
            }
            break;
        case 40: // V
            if (event.ctrlKey) {
                this.scroll_disp(1);
            } else {
                str = "\x1b[B";
            }
            break;
        case 46: //delete
            str = "\x1b[3~";
            break;
        case 45: //insert
            str = "\x1b[2~";
            break;
        case 36: //home
            str = "\x1bOH";
            break;
        case 35: //end
            str = "\x1bOF";
            break;
        case 33: //pgup
            if (event.ctrlKey) {
                this.scroll_disp(-(this.h - 1));
            } else {
                str = "\x1b[5~";
            }
            break;
        case 34: //pgdown
            if (event.ctrlKey) {
                this.scroll_disp(this.h - 1);
            } else {
                str = "\x1b[6~";
            }
            break;
        default:
            if (event.ctrlKey) {
                if (event.keyCode >= 65 && event.keyCode <= 90) {
                    str = String.fromCharCode(event.keyCode - 64);
                } else if (event.keyCode == 32) {
                    str = String.fromCharCode(0);
                }
            } else if ((!this.is_mac && event.altKey) || (this.is_mac && event.metaKey)) {
                if (event.keyCode >= 65 && event.keyCode <= 90) {
                    str = "\x1b" + String.fromCharCode(event.keyCode + 32);
                }
            }
            break;
    }
    if (str) {
        if (event.stopPropagation)
            event.stopPropagation();

        if (event.preventDefault)
            event.preventDefault();

        this.show_cursor();
        this.key_rep_state = 1;
        this.key_rep_str = str;
        this.handler(str);
        return false;
    } else {
        this.key_rep_state = 0;
        return true;
    }
};
Term.prototype.keyPressHandler = function (event) {
    var str, char_code;

    if (event.stopPropagation)
        event.stopPropagation();

    if (event.preventDefault)
        event.preventDefault();

    str = "";

    if (!("charCode" in event)) {
        char_code = event.keyCode;
        if (this.key_rep_state == 1) {
            this.key_rep_state = 2;
            return false;
        } else if (this.key_rep_state == 2) {
            this.show_cursor();
            this.handler(this.key_rep_str);
            return false;
        }
    } else {
        char_code = event.charCode;
    }
    if (char_code != 0) {
        if (!event.ctrlKey && ((!this.is_mac && !event.altKey) || (this.is_mac && !event.metaKey))) {
            str = String.fromCharCode(char_code);
        }
    }
    if (str) {
        this.show_cursor();
        this.handler(str);
        return false;
    } else {
        return true;
    }
};
Term.prototype.queue_chars = function (characters) {
    this.output_queue += characters;
    if (this.output_queue)
        setTimeout(this.outputHandler.bind(this), 0);
};

Term.prototype.outputHandler = function () {
    if (this.output_queue) {
        this.handler(this.output_queue);
        this.output_queue = "";
    }
};
