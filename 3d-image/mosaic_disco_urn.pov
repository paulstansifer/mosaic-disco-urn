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
        y, 2.89
    }
    finish { reflection {0.0} ambient 0.0 diffuse 0.0 specular 0.05 roughness 0.05 }
    pigment { Black }
}


#local Mirror = texture {
    finish { 
        reflection { 0.9 }
        specular 0.9 roughness 0.02
        diffuse 0.2 ambient 0
    }
    pigment { White*0.1 }
}

#local FleckWidth = 0.2;
#local FleckSpacing = 0.015;
#local FleckThickness = 0.05;

#macro Fleck(FleckColor)
    intersection {
        box {
            < -FleckWidth/2, -FleckWidth/2, -FleckThickness>,
            <FleckWidth/2, FleckWidth/2, 2*FleckThickness>
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
            z, FleckThickness
            texture { 
                Mirror 
                pigment { color FleckColor }
            }
        }
    }
#end

#local Level = -2.9;
#while (Level < 2.6) 
    #local PrevContact = trace(urn, Level*y - 100*z, z);

    #while (vlength(trace(urn, Level*y - 100*z, z) - PrevContact) < (FleckWidth + FleckSpacing*0.3))
        #local Level = Level + 0.05;
    #end


    #local Circumfrence = abs(trace(urn, Level*y - 100*z, z).z) * 2 * pi;
    
    #for (ang, 0, 360,  360/ (Circumfrence / (FleckWidth + FleckSpacing)))
        #local dir = (ang + 180) * y;

        #local norm = <0,0,0>;
        #local contact = trace(urn, vrotate(Level*y-100*z, dir), vrotate(z, dir), norm);

        object {
            Fleck(TRexFn(contact.x, contact.y, contact.z))

            rotate Rand_Normal(0.0, 2.0, RdmA)*y
            rotate Rand_Normal(0.0, 2.0, RdmA)*x
            rotate Rand_Normal(0.0, 0.5, RdmA)*z

            translate -z*FleckThickness*1.5
            rotate x * (VAngleD(-dir, norm) - 90)
            rotate dir
            translate contact
        }
    #end
#end

background { color rgbt <0.0, 0.0, 0.0, 1.0> }
