/*
The MIT License (MIT)

Copyright (c) 2014 Sébastien Mischler (skarab)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function (window) {
    // global
    var cycle_start_regex = /G9[89] ?/g;
    var cycle_stop_regex  = /G80 ?/g;
    var holes_regex       = /G8[123] ?/g;
    var z_regex           = /Z(\-?[0-9]+(\.?[0-9]*)?)/

    // return a gcode parameter value
    function GVal(line, param, default_value) {
        default_value = default_value || null;
        var regex     = new RegExp(param + '(\-?[0-9]+(\.?[0-9]*)?)');
        var value     = line.match(regex);
        return value ? value[1] : default_value;
    }

    /** CCDCC constructor */
    function CCDCC(input) {
    	input && this.setInput(input);
        this.remove_duplicate = true;
        this.dwell_unity = 'S';
        this.last_line = null;
    }

    // reset/init the output variables
    CCDCC.prototype._resetOutput = function() {
        this.raw_output   = '( Converted on ' + new Date().toGMTString() + ' )\n';
        this.raw_output  += '( by Cambam Canned Drilling Cycles Converter )\n';
        this.raw_output  += '( CCDCC.js - https://github.com/lautr3k/CCDCC.js )';
        this.output_array = this.raw_output.split(/\n/g);
        this.output_lines = 1;
        this.output_chars = 0;
    };

    /** Set input, split on new line and get infos */
    CCDCC.prototype.setInput = function(input) {
        // raw input
        this.raw_input = input;

        // split on new line
        this.input_array = this.raw_input.split(/\n/g);
        this.input_lines = this.input_array.length;
        this.input_chars = (this.raw_input.match(/./g) || []).length;

        // cycles count
        var cycles_match  = this.raw_input.match(cycle_start_regex);
        this.cycles_count = cycles_match ? cycles_match.length : 'n/a';

        // holes count
        var holes_match  = this.raw_input.match(holes_regex);
        this.holes_count = holes_match ? holes_match.length : 'n/a';

        // init output variables
        this._resetOutput();
    };

    /** Add a gcode line */
    CCDCC.prototype.push_line = function(line) {
        if (this.remove_duplicate && this.last_line == line)
            return;
        this.output_array.push(line);
        this.last_line = line;
    }

    /** Convert the input and return the output as text */
    CCDCC.prototype.convert = function() {
        // self pointer
        var self = this;

        // reset output variables
        this._resetOutput();

        // temp vars
        var cdc_stared   = false;
        var last_z_value = null;
        var last_r_value = null;  // R-Plane
        var last_d_value = null;  // final z depth
        var last_f_value = null;  // feedrate
        var last_p_value = null;  // dwell in seconds
        var last_q_value = null;  // peck travel
        var retract_type = null;  // 1 = Initial-Z | 2 = R-Plane

        // for each input lines
        $.each(this.input_array, function(i, line) {
            // remove whitespace from the 
            // beginning and end of the line
            line = $.trim(line);

            // the new line
            new_line = null;

            // cdc start tag
            var start_tag = line.match(cycle_start_regex);

            if (start_tag) {
                cdc_stared   = true;
                line         = line.replace(cycle_start_regex, '');
                retract_type = $.trim(start_tag[0]) == 'G98' ? 1 : 2;
                last_d_value = null;
                last_r_value = null;
                last_f_value = null;
                last_p_value = null;
                last_q_value = null;

            }
            else if (line.match(cycle_stop_regex)) {
                cdc_stared = false;
                line       = line.replace(cycle_stop_regex, '');
            }

            // conversion
            if (cdc_stared) {
                // hole tag
                var hole_tag = line.match(holes_regex);
                
                if (hole_tag) {
                    line = line.replace(holes_regex, '');
                    
                    // update last values
                    last_d_value = GVal(line, 'Z', last_d_value);
                    last_r_value = GVal(line, 'R', last_r_value);
                    last_f_value = GVal(line, 'F', last_f_value);
                    last_p_value = GVal(line, 'P', last_p_value);
                    last_q_value = GVal(line, 'Q', last_q_value);

                    // retract position
                    var r_plane = retract_type == 1 ? last_z_value : last_r_value;

                    // x/y positions
                    var x = GVal(line, 'X');
                    var y = GVal(line, 'Y');

                    // rapids to X/Y
                    new_line = 'G0';

                    if (x) new_line += ' X' + x;
                    if (y) new_line += ' Y' + y;
                    
                    self.push_line(new_line);
                        
                    // rapids to R-Plane
                    new_line  = 'G0 Z' + r_plane;
                    self.push_line(new_line);

                    // peck drills
                    if (last_q_value > 0) {
                        // start values
                        var depth     = last_r_value - last_d_value; // travel depth
                        var cycles    = depth / last_q_value;        // cycles count
                        var rest      = depth % last_q_value;        // final pass
                        var z_pos     = last_r_value;                // current z position
                        
                        // for each cycle
                        for (var i = 1; i < cycles; i++) {
                            // decrement depth
                            z_pos -= last_q_value;
                            
                            // feed down to depth at feedrate (F and Z)
                            new_line  = 'G1';
                            new_line += ' F' + last_f_value;
                            new_line += ' Z' + z_pos;
                            self.push_line(new_line);
                            
                            // rapids to retract position (R)
                            new_line  = 'G0 Z' + last_r_value;
                            self.push_line(new_line);
                        }

                        // final depth not reached
                        if (rest > 0) {
                            // feed down
                            new_line  = 'G1';
                            new_line += ' F' + last_f_value;
                            new_line += ' Z' + last_d_value;
                            self.push_line(new_line);
                        }
                    }
                    else {
                        // feed down
                        new_line  = 'G1';
                        new_line += ' F' + last_f_value;
                        new_line += ' Z' + last_d_value;
                        self.push_line(new_line);
                    }

                    // dwell
                    if (last_p_value > 0) {
                        new_line  = 'G4 ' + self.dwell_unity + last_p_value;
                        self.push_line(new_line);
                    }
                        
                    // rapids to R-Plane
                    new_line  = 'G0 Z' + r_plane;
                    self.push_line(new_line);
                }
            }
            else {
                // backups last found x/y/z values
                last_z_value = GVal(line, 'Z', last_z_value);

                // juste put the line if not empty
                line && self.push_line(line);
            }
        });

        // output lines count and raw output
        this.output_lines = this.output_array.length;
        this.raw_output   = this.output_array.join('\n') + '\n';
        this.output_chars = (this.raw_output.match(/./g) || []).length;

    	// return the output
        return this.raw_output;
    };
    
    // export
    window.CCDCC = CCDCC;

})(this);