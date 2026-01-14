#version 3.7;

#include "colors.inc"
#include "transforms.inc"
#include "rand.inc"
#include "textures.inc"

global_settings {
    assumed_gamma 1.0
}

#declare TRexFn = function {
    pigment { 
        image_map {
            png "trex.png"
            once
            map_type 1
        }
        rotate 160*y
     }
}


camera {
    location -12*z+3*y
    direction 1.5*z
    right     x
    look_at   <0,0,0>
}

#for (idx,0,14)
    light_source {
        <0,0,20>
        color rgb <1,1,1> * 0.2
        looks_like {
            sphere {
                <0,0,0>, 1.75
                pigment { White }
                finish { ambient 1.0 }
                no_image
            }
        }
        translate y * (mod(idx, 2) - 0.5) * 10
        rotate y*(idx/14)*360
    }
#end


#local urn = 
    lathe {
        cubic_spline
        7
        <0, 0>, <1, 0>, <3, 1>, <3, 4>, <1.8, 5>, <1.8, 6>, <2.3, 7>
        translate y*-3
    }

intersection {
    object {
        urn
    }
    plane {
        y, 2.93
    }
    finish { reflection {0.0} ambient 0.0 diffuse 0.0 specular 0.05 roughness 0.05 }
    pigment { Black }
}


#local mirror = texture {
    finish { 
        reflection { 0.9 }
        specular 0.9 roughness 0.02
        diffuse 0.2 ambient 0
    }
    pigment { White*0.1 }
}

#local fleck_width = 0.2;
#local fleck_spacing = 0.015;
#local fleck_thickness = 0.05;

#macro Fleck(FleckColor)
    intersection {
        box {
            < -fleck_width/2, -fleck_width/2, -fleck_thickness>,
            <fleck_width/2, fleck_width/2, 2*fleck_thickness>
            material { M_Glass3 }
        }
        plane {
            -z, 0
            material { 
                M_Glass3 
                texture { 
                    pigment { color rgbf <FleckColor.red, FleckColor.green, FleckColor.blue, 0.5> } 
                    finish { Glass_Finish }
                }
            }
        }
        plane {
            z, fleck_thickness
            texture { 
                mirror 
                pigment { color FleckColor }
            }
        }
    }
#end

#local fleck = 
    intersection {
        box {
            < -fleck_width/2, -fleck_width/2, -fleck_thickness>,
            <fleck_width/2, fleck_width/2, 2*fleck_thickness>
            material { M_Glass3 }
        }
        plane {
            -z, 0
            material { M_Glass3 }
        }
        plane {
            z, fleck_thickness
            texture { mirror }
        }
    }


#local last_circumfrenence = -1;

#local level = -2.9;
#while (level < 2.6) 
    #local prev_contact = trace(urn, level*y - 100*z, z);

    #while (vlength(trace(urn, level*y - 100*z, z) - prev_contact) < (fleck_width + fleck_spacing*0.3))
        #local level = level + 0.05;
    #end


    #local circumfrence = abs(trace(urn, level*y - 100*z, z).z) * 2 * pi;
    
    #for (ang, 0, 360,  360/ (circumfrence / (fleck_width + fleck_spacing)))
        #local dir = (ang + 180) * y;

        #local norm = <0,0,0>;
        #local contact = trace(urn, vrotate(level*y-100*z, dir), vrotate(z, dir), norm);

        #local color_here = TRexFn(contact.x, contact.y, contact.z);

        object {
            Fleck(color_here)

            rotate Rand_Normal(0.0, 2.0, RdmA)*y
            rotate Rand_Normal(0.0, 2.0, RdmA)*x
            rotate Rand_Normal(0.0, 0.5, RdmA)*z

            translate -z*fleck_thickness*1.5
            rotate x * (VAngleD(-dir, norm) - 90)
            rotate dir
            translate contact
            // finish { 
            //     reflection { 0.9 }
            //     specular 0.9 roughness 0.02
            //     diffuse 0.2 ambient 0
            // }
            // pigment { White*0.1 }
            //pigment { color color_here  }
        }
    #end
#end

background { color rgbt <0.0, 0.0, 0.0, 1.0> }
