"use client";

import { useState, useCallback } from "react";
import { generateImage } from "../muapi.js";

// All options sourced from live studio with correct category mapping
// Images downloaded locally to /assets/influencer_studio/
const TABS_CONFIG = {
  face: {
    label: "Face",
    subcategories: [
      {
        id: "character_type",
        label: "Character Type",
        options: [
          { id: "human", label: "Human", img: "/assets/influencer_studio/character_type_human.webp", promptVal: "human features" },
          { id: "elf", label: "Elf", img: "/assets/influencer_studio/character_type_elf.webp", promptVal: "elf with pointed ears" },
          { id: "alien", label: "Alien", img: "/assets/influencer_studio/character_type_alien.webp", promptVal: "alien creature" },
          { id: "amphibian", label: "Amphibian", img: "/assets/influencer_studio/character_type_amphibian.webp", promptVal: "amphibian humanoid" },
          { id: "reptile", label: "Reptile", img: "/assets/influencer_studio/character_type_reptile.webp", promptVal: "reptilian creature" },
          { id: "mantis", label: "Mantis", img: "/assets/influencer_studio/character_type_mantis.webp", promptVal: "mantis hybrid character" },
          { id: "bee", label: "Bee", img: "/assets/influencer_studio/character_type_bee.webp", promptVal: "bee insect hybrid character" },
          { id: "octopus", label: "Octopus", img: "/assets/influencer_studio/character_type_octopus.webp", promptVal: "aquatic octopus hybrid" },
          { id: "crocodile", label: "Crocodile", img: "/assets/influencer_studio/character_type_crocodile.webp", promptVal: "crocodile humanoid" },
          { id: "iguana", label: "Iguana", img: "/assets/influencer_studio/character_type_iguana.webp", promptVal: "iguana humanoid" },
          { id: "lizard", label: "Lizard", img: "/assets/influencer_studio/character_type_lizard.webp", promptVal: "lizard humanoid" },
          { id: "rhinoceros_beetle", label: "Beetle", img: "/assets/influencer_studio/character_type_rhinoceros_beetle.webp", promptVal: "rhinoceros beetle humanoid" },
          { id: "ant", label: "Ant", img: "/assets/influencer_studio/character_type_ant.webp", promptVal: "ant hybrid character" },
        ],
      },
      {
        id: "gender",
        label: "Gender",
        options: [
          { id: "female", label: "Female", img: "/assets/influencer_studio/gender_female.webp", promptVal: "female" },
          { id: "male", label: "Male", img: "/assets/influencer_studio/gender_male.webp", promptVal: "male" },
          { id: "non_binary", label: "Non-binary", img: "/assets/influencer_studio/gender_non_binary.webp", promptVal: "non-binary character" },
          { id: "trans_man", label: "Trans Man", img: "/assets/influencer_studio/gender_trans_man.webp", promptVal: "transgender man" },
          { id: "trans_woman", label: "Trans Woman", img: "/assets/influencer_studio/gender_trans_woman.webp", promptVal: "transgender woman" },
        ],
      },
      {
        id: "ethnicity_origin_base",
        label: "Ethnicity / Origin",
        options: [
          { id: "african", label: "African", img: "/assets/influencer_studio/ethnicity_origin_base_african.webp", promptVal: "african heritage" },
          { id: "asian", label: "Asian", img: "/assets/influencer_studio/ethnicity_origin_base_recreate_in_east_asian_supermodel__korea.webp", promptVal: "East Asian supermodel, Korean K-Pop Idol phenotype" },
          { id: "european", label: "European", img: "/assets/influencer_studio/ethnicity_origin_base_scandinavian_supermodel.webp", promptVal: "Scandinavian Supermodel" },
          { id: "indian", label: "Indian", img: "/assets/influencer_studio/ethnicity_origin_base_indian.webp", promptVal: "south asian indian heritage" },
          { id: "middle_eastern", label: "Middle Eastern", img: "/assets/influencer_studio/ethnicity_origin_base_middle_eastern.webp", promptVal: "middle eastern heritage" },
          { id: "mixed", label: "Mixed", img: "/assets/influencer_studio/ethnicity_origin_base_mixed.webp", promptVal: "multiracial mixed heritage" },
        ],
      },
      {
        id: "eye_color",
        label: "Eye Color",
        options: [
          { id: "eye_blue", label: "Blue", img: "/assets/influencer_studio/eye_color_eye_blue.webp", promptVal: "striking blue eyes" },
          { id: "eye_brown", label: "Brown", img: "/assets/influencer_studio/eye_color_eye_brown.webp", promptVal: "warm brown eyes" },
          { id: "eye_green", label: "Green", img: "/assets/influencer_studio/eye_color_eye_green.webp", promptVal: "emerald green eyes" },
          { id: "eye_amber", label: "Amber", img: "/assets/influencer_studio/eye_color_eye_amber.webp", promptVal: "amber eyes" },
          { id: "eye_grey", label: "Grey", img: "/assets/influencer_studio/eye_color_eye_grey.webp", promptVal: "grey eyes" },
          { id: "eye_red", label: "Red", img: "/assets/influencer_studio/eye_color_eye_red.webp", promptVal: "red eyes" },
          { id: "eye_purple", label: "Purple", img: "/assets/influencer_studio/eye_color_eye_purple.webp", promptVal: "violet purple eyes" },
          { id: "eye_black", label: "Black", img: "/assets/influencer_studio/eye_color_eye_black.webp", promptVal: "black eyes" },
          { id: "eye_deep_brown", label: "Deep Brown", img: "/assets/influencer_studio/eye_color_eye_deep_brown.webp", promptVal: "deep dark brown eyes" },
          { id: "eye_white", label: "White", img: "/assets/influencer_studio/eye_color_eye_white.webp", promptVal: "white eyes" },
          { id: "eye_black_void", label: "Solid Black Void", img: "/assets/influencer_studio/eye_color_eye_black_void.webp", promptVal: "solid black void eyes" },
          { id: "eye_white_void", label: "Blind / Empty", img: "/assets/influencer_studio/eye_color_eye_white_void.webp", promptVal: "blind empty white eyes" },
        ],
      },
      {
        id: "eyes_type",
        label: "Eye Type",
        options: [
          { id: "eyes_human", label: "Human", img: "/assets/influencer_studio/eyes_type_eyes_human.webp", promptVal: "normal human eyes" },
          { id: "eyes_reptile", label: "Reptile", img: "/assets/influencer_studio/eyes_type_eyes_reptile.webp", promptVal: "reptile slit-pupil eyes" },
          { id: "eyes_mechanical", label: "Mechanical", img: "/assets/influencer_studio/eyes_type_eyes_mechanical.webp", promptVal: "mechanical cyborg eyes" },
        ],
      },
      {
        id: "eyes_details",
        label: "Eye Features",
        options: [
          { id: "eyes_different_colors", label: "Heterochromia", img: "/assets/influencer_studio/eyes_details_eyes_different_colors.webp", promptVal: "heterochromia different eye colors" },
          { id: "eyes_blind", label: "Blind Eye", img: "/assets/influencer_studio/eyes_details_eyes_blind.webp", promptVal: "one cloudy blind eye" },
          { id: "eyes_scarred", label: "Scarred Eye", img: "/assets/influencer_studio/eyes_details_eyes_scarred.webp", promptVal: "scar running across one eye" },
          { id: "eyes_glowing", label: "Glowing Eye", img: "/assets/influencer_studio/eyes_details_eyes_glowing.webp", promptVal: "glowing magical eyes" },
        ],
      },
      {
        id: "mouth",
        label: "Mouth & Teeth",
        options: [
          { id: "mouth_small", label: "Small Mouth", img: "/assets/influencer_studio/mouth_mouth_small.webp", promptVal: "small delicate mouth" },
          { id: "mouth_large", label: "Large Mouth", img: "/assets/influencer_studio/mouth_mouth_large.webp", promptVal: "wide expressive mouth" },
          { id: "mouth_no_teeth", label: "No Teeth", img: "/assets/influencer_studio/mouth_mouth_no_teeth.webp", promptVal: "no visible teeth" },
          { id: "mouth_different_teeth", label: "Unique Teeth", img: "/assets/influencer_studio/mouth_mouth_different_teeth.webp", promptVal: "unusual tooth structure" },
          { id: "mouth_sharp_teeth", label: "Sharp Teeth", img: "/assets/influencer_studio/mouth_mouth_sharp_teeth.webp", promptVal: "sharp predatory fangs" },
          { id: "mouth_forked_tongue", label: "Forked Tongue", img: "/assets/influencer_studio/mouth_mouth_forked_tongue.webp", promptVal: "reptilian forked tongue" },
          { id: "mouth_two_tongues", label: "Two Tongues", img: "/assets/influencer_studio/mouth_mouth_two_tongues.webp", promptVal: "two separate tongues" },
        ],
      },
      {
        id: "ears",
        label: "Ears",
        options: [
          { id: "ears_human", label: "Human", img: "/assets/influencer_studio/ears_ears_human.webp", promptVal: "normal human ears" },
          { id: "ears_elf", label: "Elf Ears", img: "/assets/influencer_studio/ears_ears_elf.webp", promptVal: "pointed elf ears" },
          { id: "ears_no", label: "No Ears", img: "/assets/influencer_studio/ears_ears_no.webp", promptVal: "no visible ears" },
        ],
      },
      {
        id: "horns",
        label: "Horns",
        options: [
          { id: "small_horns", label: "Small Horns", img: "/assets/influencer_studio/horns_small_horns.webp", promptVal: "small horns on forehead" },
          { id: "big_horns", label: "Big Horns", img: "/assets/influencer_studio/horns_big_horns.webp", promptVal: "large curved horns" },
          { id: "antlers", label: "Antlers", img: "/assets/influencer_studio/horns_antlers.webp", promptVal: "deer antlers on head" },
        ],
      },
      {
        id: "skin_conditions",
        label: "Skin Conditions",
        options: [
          { id: "condition_vitiligo", label: "Vitiligo", img: "/assets/influencer_studio/skin_conditions_condition_vitiligo.webp", promptVal: "vitiligo skin condition" },
          { id: "condition_pigmentation", label: "Pigmentation", img: "/assets/influencer_studio/skin_conditions_condition_pigmentation.webp", promptVal: "hyperpigmentation" },
          { id: "condition_freckles", label: "Freckles", img: "/assets/influencer_studio/skin_conditions_condition_freckles.webp", promptVal: "freckled skin" },
          { id: "condition_birthmarks", label: "Birthmarks", img: "/assets/influencer_studio/skin_conditions_condition_birthmarks.webp", promptVal: "visible birthmarks" },
          { id: "condition_scars", label: "Scars", img: "/assets/influencer_studio/skin_conditions_condition_scars.webp", promptVal: "scarred skin" },
          { id: "condition_burns", label: "Burns", img: "/assets/influencer_studio/skin_conditions_condition_burns.webp", promptVal: "burn marks on skin" },
          { id: "condition_albinism", label: "Albinism", img: "/assets/influencer_studio/skin_conditions_condition_albinism.webp", promptVal: "albinism pale white skin" },
          { id: "condition_cracked", label: "Cracked Skin", img: "/assets/influencer_studio/skin_conditions_condition_cracked.webp", promptVal: "cracked dry skin texture" },
          { id: "condition_wrinkled", label: "Wrinkled", img: "/assets/influencer_studio/skin_conditions_condition_wrinkled.webp", promptVal: "wrinkled aged skin" },
        ],
      },
    ],
  },
  body: {
    label: "Body",
    subcategories: [
      {
        id: "face_skin_material",
        label: "Face Skin Material",
        options: [
          { id: "face_skin_human", label: "Human Skin", img: "/assets/influencer_studio/face_skin_material_face_skin_human.webp", promptVal: "smooth human skin" },
          { id: "face_skin_scales", label: "Scales", img: "/assets/influencer_studio/face_skin_material_face_skin_scales.webp", promptVal: "shimmering scales" },
          { id: "face_skin_fur", label: "Fur", img: "/assets/influencer_studio/face_skin_material_face_skin_fur.webp", promptVal: "soft fur covered face" },
          { id: "face_skin_amphibian", label: "Amphibian", img: "/assets/influencer_studio/face_skin_material_face_skin_amphibian.webp", promptVal: "smooth moist amphibian skin" },
          { id: "face_skin_fish", label: "Fish Skin", img: "/assets/influencer_studio/face_skin_material_face_skin_fish.webp", promptVal: "iridescent fish scale skin" },
          { id: "face_skin_metallic", label: "Metallic", img: "/assets/influencer_studio/face_skin_material_face_skin_metallic.webp", promptVal: "polished metallic skin" },
        ],
      },
      {
        id: "face_surface_pattern",
        label: "Skin Pattern",
        options: [
          { id: "face_pattern_solid", label: "Solid Color", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_solid.webp", promptVal: "solid color skin" },
          { id: "face_pattern_stripes", label: "Stripes", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_stripes.webp", promptVal: "exotic striped skin pattern" },
          { id: "face_pattern_spots", label: "Spots", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_spots.webp", promptVal: "dappled spotted skin" },
          { id: "face_pattern_chess", label: "Chess Pattern", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_chess.webp", promptVal: "checkerboard skin pattern" },
          { id: "face_pattern_veins", label: "Veins Visible", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_veins.webp", promptVal: "translucent skin with neon veins" },
          { id: "face_pattern_gradient", label: "Gradient", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_gradient.webp", promptVal: "gradient skin coloring" },
          { id: "face_pattern_giraffe", label: "Giraffe Pattern", img: "/assets/influencer_studio/face_surface_pattern_face_pattern_giraffe.webp", promptVal: "giraffe print skin markings" },
        ],
      },
      {
        id: "body_type",
        label: "Body Type",
        options: [
          { id: "body_slim", label: "Slim", img: "/assets/influencer_studio/body_type_body_slim.webp", promptVal: "slim slender physique" },
          { id: "body_lean", label: "Lean", img: "/assets/influencer_studio/body_type_body_lean.webp", promptVal: "lean toned physique" },
          { id: "body_athletic", label: "Athletic", img: "/assets/influencer_studio/body_type_body_athletic.webp", promptVal: "fit athletic body" },
          { id: "body_muscular", label: "Muscular", img: "/assets/influencer_studio/body_type_body_muscular.webp", promptVal: "strong muscular build" },
          { id: "body_curvy", label: "Curvy", img: "/assets/influencer_studio/body_type_body_curvy.webp", promptVal: "curvy body type" },
          { id: "body_heavy", label: "Heavy", img: "/assets/influencer_studio/body_type_body_heavy.webp", promptVal: "heavy set build" },
          { id: "body_skinny", label: "Skinny", img: "/assets/influencer_studio/body_type_body_skinny.webp", promptVal: "very skinny thin build" },
        ],
      },
      {
        id: "left_arm",
        label: "Left Arm",
        options: [
          { id: "left_arm_normal", label: "Normal", img: "/assets/influencer_studio/left_arm_left_arm_normal.webp", promptVal: "normal left arm" },
          { id: "left_arm_cute", label: "Cute Prosthetic", img: "/assets/influencer_studio/left_arm_make_left_arm_stylish_pink_prosthetic_wi.webp", promptVal: "stylish pink prosthetic left arm with cute stickers" },
          { id: "left_arm_robotic", label: "Robotic", img: "/assets/influencer_studio/left_arm_left_arm_robotic.webp", promptVal: "robotic left arm" },
          { id: "left_arm_prosthetic", label: "Prosthetic", img: "/assets/influencer_studio/left_arm_left_arm_prosthetic.webp", promptVal: "prosthetic left arm" },
          { id: "left_arm_mechanical", label: "Mechanical", img: "/assets/influencer_studio/left_arm_left_arm_mechanical.webp", promptVal: "mechanical left arm" },
          { id: "left_arm_none", label: "None", img: "/assets/influencer_studio/left_arm_left_arm_none.webp", promptVal: "no left arm" },
        ],
      },
      {
        id: "right_arm",
        label: "Right Arm",
        options: [
          { id: "right_arm_normal", label: "Normal", img: "/assets/influencer_studio/right_arm_right_arm_normal.webp", promptVal: "normal right arm" },
          { id: "right_arm_cute", label: "Cute Prosthetic", img: "/assets/influencer_studio/right_arm_make_right_arm_stylish_pink_prosthetic_w.webp", promptVal: "stylish pink prosthetic right arm with cute stickers" },
          { id: "right_arm_robotic", label: "Robotic", img: "/assets/influencer_studio/right_arm_right_arm_robotic.webp", promptVal: "robotic right arm" },
          { id: "right_arm_prosthetic", label: "Prosthetic", img: "/assets/influencer_studio/right_arm_right_arm_prosthetic.webp", promptVal: "prosthetic right arm" },
          { id: "right_arm_mechanical", label: "Mechanical", img: "/assets/influencer_studio/right_arm_right_arm_mechanical.webp", promptVal: "mechanical right arm" },
          { id: "right_arm_none", label: "None", img: "/assets/influencer_studio/right_arm_right_arm_none.webp", promptVal: "no right arm" },
        ],
      },
      {
        id: "left_leg",
        label: "Left Leg",
        options: [
          { id: "left_leg_normal", label: "Normal", img: "/assets/influencer_studio/left_leg_left_leg_normal.webp", promptVal: "normal left leg" },
          { id: "left_leg_cute", label: "Cute Prosthetic", img: "/assets/influencer_studio/left_leg_make_left_leg_stylish_pink_prosthetic_wi.webp", promptVal: "stylish pink prosthetic left leg with cute stickers" },
          { id: "left_leg_robotic", label: "Robotic", img: "/assets/influencer_studio/left_leg_left_leg_robotic.webp", promptVal: "robotic left leg" },
          { id: "left_leg_prosthetic", label: "Prosthetic", img: "/assets/influencer_studio/left_leg_left_leg_prosthetic.webp", promptVal: "prosthetic left leg" },
          { id: "left_leg_mechanical", label: "Mechanical", img: "/assets/influencer_studio/left_leg_left_leg_mechanical.webp", promptVal: "mechanical left leg" },
          { id: "left_leg_none", label: "None", img: "/assets/influencer_studio/left_leg_left_leg_none.webp", promptVal: "no left leg" },
        ],
      },
      {
        id: "right_leg",
        label: "Right Leg",
        options: [
          { id: "right_leg_normal", label: "Normal", img: "/assets/influencer_studio/right_leg_right_leg_normal.webp", promptVal: "normal right leg" },
          { id: "right_leg_cute", label: "Cute Prosthetic", img: "/assets/influencer_studio/right_leg_make_right_leg_stylish_pink_prosthetic_w.webp", promptVal: "stylish pink prosthetic right leg with cute stickers" },
          { id: "right_leg_robotic", label: "Robotic", img: "/assets/influencer_studio/right_leg_right_leg_robotic.webp", promptVal: "robotic right leg" },
          { id: "right_leg_prosthetic", label: "Prosthetic", img: "/assets/influencer_studio/right_leg_right_leg_prosthetic.webp", promptVal: "prosthetic right leg" },
          { id: "right_leg_mechanical", label: "Mechanical", img: "/assets/influencer_studio/right_leg_right_leg_mechanical.webp", promptVal: "mechanical right leg" },
          { id: "right_leg_none", label: "None", img: "/assets/influencer_studio/right_leg_right_leg_none.webp", promptVal: "no right leg" },
        ],
      },
    ],
  },
  style: {
    label: "Style",
    subcategories: [
      {
        id: "hair",
        label: "Hair / Head Growth",
        options: [
          { id: "hair_bald", label: "Bald", img: "/assets/influencer_studio/hair_hair_bald.webp", promptVal: "bald head" },
          { id: "hair_short", label: "Short Hair", img: "/assets/influencer_studio/hair_hair_short.webp", promptVal: "short hair" },
          { id: "hair_long", label: "Long Hair", img: "/assets/influencer_studio/hair_hair_long.webp", promptVal: "long flowing hair" },
          { id: "hair_afro", label: "Afro", img: "/assets/influencer_studio/hair_hair_afro.webp", promptVal: "afro hairstyle" },
          { id: "hair_punk", label: "Punk", img: "/assets/influencer_studio/hair_hair_punk.webp", promptVal: "punk mohawk hairstyle" },
          { id: "hair_fur", label: "Fur / Mane", img: "/assets/influencer_studio/hair_hair_fur.webp", promptVal: "fur mane on head" },
          { id: "hair_tentacles", label: "Tentacles", img: "/assets/influencer_studio/hair_hair_tentacles.webp", promptVal: "tentacles as hair" },
          { id: "hair_spines", label: "Spines", img: "/assets/influencer_studio/hair_hair_spines.webp", promptVal: "spines as hair" },
        ],
      },
      {
        id: "accessories",
        label: "Accessories & Markings",
        options: [
          { id: "accessory_tattoos", label: "Tattoos", img: "/assets/influencer_studio/accessories_accessory_tattoos.webp", promptVal: "covered in tattoos" },
          { id: "accessory_piercing", label: "Piercings", img: "/assets/influencer_studio/accessories_accessory_piercing.webp", promptVal: "multiple piercings" },
          { id: "accessory_scarification", label: "Scarification", img: "/assets/influencer_studio/accessories_accessory_scarification.webp", promptVal: "ritual scarification marks" },
          { id: "accessory_symbols", label: "Symbols / Markings", img: "/assets/influencer_studio/accessories_accessory_symbols.webp", promptVal: "symbolic tribal markings" },
          { id: "accessory_cyber", label: "Cyber Markings", img: "/assets/influencer_studio/accessories_accessory_cyber.webp", promptVal: "cyberpunk circuit markings" },
        ],
      },
      {
        id: "rendering_style",
        label: "Rendering Style",
        options: [
          { id: "style_hyper_realistic", label: "Hyper-Realistic", img: "/assets/influencer_studio/character_type_human.webp", promptVal: "hyper-realistic 8k photograph" },
          { id: "style_anime", label: "Anime", img: "/assets/influencer_studio/character_type_elf.webp", promptVal: "anime art style" },
          { id: "style_cartoon", label: "Cartoon", img: "/assets/influencer_studio/character_type_mantis.webp", promptVal: "cartoon illustration style" },
          { id: "style_2d_illustration", label: "2D Illustration", img: "/assets/influencer_studio/character_type_alien.webp", promptVal: "2D flat illustration style" },
        ],
      },
    ],
  },
};

export default function AiInfluencerStudio({ onGenerate, isGenerating: externalIsGenerating }) {
  const [activeTab, setActiveTab] = useState("face");

  // Initialize with first option in each subcategory
  const [selectedOptions, setSelectedOptions] = useState(() => {
    const initial = {};
    Object.keys(TABS_CONFIG).forEach((tabKey) => {
      TABS_CONFIG[tabKey].subcategories.forEach((sub) => {
        if (sub.options && sub.options.length > 0) {
          initial[sub.id] = sub.options[0].id;
        }
      });
    });
    return initial;
  });

  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [customPromptText, setCustomPromptText] = useState("");
  const [isGeneratingInternal, setIsGeneratingInternal] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isGenerating = externalIsGenerating || isGeneratingInternal;

  // Build character prompt from selections
  const buildPromptFromSelections = useCallback(() => {
    const promptParts = [];
    Object.keys(TABS_CONFIG).forEach((tabKey) => {
      TABS_CONFIG[tabKey].subcategories.forEach((sub) => {
        const selectedId = selectedOptions[sub.id];
        if (selectedId) {
          const matchedOpt = sub.options.find((o) => o.id === selectedId);
          if (matchedOpt && matchedOpt.promptVal) {
            promptParts.push(matchedOpt.promptVal);
          }
        }
      });
    });

    let finalPrompt =
      "Ultra-realistic professional portrait photograph of an AI influencer character, 8k resolution, cinematic lighting, sharp detail";
    if (promptParts.length > 0) {
      finalPrompt += ", " + promptParts.join(", ");
    }
    if (customPromptText.trim()) {
      finalPrompt += ", " + customPromptText.trim();
    }
    return finalPrompt;
  }, [selectedOptions, customPromptText]);

  const handleOptionSelect = (subcatId, optionId) => {
    setSelectedOptions((prev) => ({ ...prev, [subcatId]: optionId }));
  };

  // Shuffle: randomly pick one option per subcategory
  const handleShuffle = () => {
    const newSelections = {};
    Object.keys(TABS_CONFIG).forEach((tabKey) => {
      TABS_CONFIG[tabKey].subcategories.forEach((sub) => {
        if (sub.options && sub.options.length > 0) {
          const randomIndex = Math.floor(Math.random() * sub.options.length);
          newSelections[sub.id] = sub.options[randomIndex].id;
        }
      });
    });
    setSelectedOptions(newSelections);
  };

  // Single-request generate
  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGeneratingInternal(true);
    setErrorMsg("");
    setGenerationResult(null);

    const fullPrompt = buildPromptFromSelections();

    try {
      if (onGenerate) {
        await onGenerate({ prompt: fullPrompt, aspectRatio, selections: selectedOptions });
      } else {
        const res = await generateImage({ prompt: fullPrompt, aspect_ratio: aspectRatio });
        setGenerationResult(res);
      }
    } catch (err) {
      console.error("Studio Generation Error:", err);
      setErrorMsg(err?.message || "Failed to generate character image");
    } finally {
      setIsGeneratingInternal(false);
    }
  };

  const tabKeys = Object.keys(TABS_CONFIG);

  const getAspectRatioStyle = () => {
    const map = { "3:4": "3/4", "1:1": "1/1", "9:16": "9/16", "16:9": "16/9" };
    return map[aspectRatio] || "3/4";
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0F1117",
        color: "#fff",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        userSelect: "none",
      }}
    >
      {/* ── Header Bar ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(20,23,34,0.9)",
          backdropFilter: "blur(12px)",
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(124,58,237,0.35)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.01em", color: "#fff" }}>
              AI Influencer Studio
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
              Design a unique AI character with fine-grained controls
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Shuffle Button */}
          <button
            onClick={handleShuffle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#a78bfa",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
            </svg>
            Shuffle
          </button>

          {/* Aspect Ratio */}
          <div
            style={{
              display: "flex",
              gap: 2,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: 3,
            }}
          >
            {["3:4", "1:1", "9:16", "16:9"].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: aspectRatio === ratio ? "#7c3aed" : "transparent",
                  color: aspectRatio === ratio ? "#fff" : "#9ca3af",
                  boxShadow: aspectRatio === ratio ? "0 2px 8px rgba(124,58,237,0.4)" : "none",
                }}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 20px",
              borderRadius: 10,
              background: isGenerating ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: isGenerating ? "not-allowed" : "pointer",
              boxShadow: isGenerating ? "none" : "0 4px 14px rgba(124,58,237,0.4)",
              transition: "all 0.15s",
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            {isGenerating ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Character
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Customizer Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab Nav */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "12px 24px 0",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(20,23,34,0.5)",
              flexShrink: 0,
            }}
          >
            {tabKeys.map((tabKey) => {
              const tab = TABS_CONFIG[tabKey];
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  onClick={() => setActiveTab(tabKey)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 18px 12px",
                    borderRadius: "10px 10px 0 0",
                    border: "none",
                    borderBottom: isActive ? "2px solid #7c3aed" : "2px solid transparent",
                    background: isActive ? "rgba(124,58,237,0.12)" : "transparent",
                    color: isActive ? "#a78bfa" : "#6b7280",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {tab.label}
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 20,
                      background: isActive ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.07)",
                      color: isActive ? "#c4b5fd" : "#6b7280",
                    }}
                  >
                    {tab.subcategories?.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Options Grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
            {TABS_CONFIG[activeTab]?.subcategories?.map((subcat) => (
              <div key={subcat.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {subcat.label}
                  </span>
                  <span style={{ fontSize: 10, color: "#4b5563" }}>
                    {subcat.options?.length} options
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
                    gap: 10,
                  }}
                >
                  {subcat.options?.map((opt) => {
                    const isSelected = selectedOptions[subcat.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleOptionSelect(subcat.id, opt.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: 8,
                          borderRadius: 12,
                          border: isSelected
                            ? "1.5px solid #7c3aed"
                            : "1.5px solid rgba(255,255,255,0.06)",
                          background: isSelected
                            ? "rgba(124,58,237,0.15)"
                            : "rgba(22,25,38,0.9)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          boxShadow: isSelected ? "0 0 0 3px rgba(124,58,237,0.15), 0 4px 12px rgba(124,58,237,0.2)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.border = "1.5px solid rgba(255,255,255,0.15)";
                            e.currentTarget.style.background = "rgba(30,33,50,0.95)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.border = "1.5px solid rgba(255,255,255,0.06)";
                            e.currentTarget.style.background = "rgba(22,25,38,0.9)";
                          }
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "1/1",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "#000",
                            marginBottom: 7,
                            position: "relative",
                          }}
                        >
                          <img
                            src={opt.img}
                            alt={opt.label}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              transition: "transform 0.3s",
                            }}
                            loading="lazy"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "/assets/influencer_studio/character_type_human.webp";
                            }}
                          />
                          {isSelected && (
                            <div
                              style={{
                                position: "absolute",
                                top: 5,
                                right: 5,
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                background: "#7c3aed",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 6px rgba(124,58,237,0.5)",
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Label */}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: isSelected ? "#c4b5fd" : "#9ca3af",
                            textAlign: "center",
                            lineHeight: 1.3,
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Preview Panel */}
        <div
          style={{
            width: 340,
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            background: "#12141D",
            display: "flex",
            flexDirection: "column",
            padding: 20,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 14,
            }}
          >
            Character Preview
          </div>

          {/* Preview image box */}
          <div
            style={{
              width: "100%",
              aspectRatio: getAspectRatioStyle(),
              maxHeight: 420,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#181B26",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: 16,
              position: "relative",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {generationResult?.url ? (
              <img
                src={generationResult.url}
                alt="Generated AI Character"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : isGenerating ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 24 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: "3px solid rgba(124,58,237,0.3)",
                    borderTop: "3px solid #7c3aed",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <span style={{ fontSize: 11, color: "#a78bfa", textAlign: "center" }}>
                  Generating your character…
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: 24,
                  color: "#374151",
                  textAlign: "center",
                }}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span style={{ fontSize: 11, color: "#4b5563" }}>
                  Select options and click<br />Generate to create your character
                </span>
              </div>
            )}
          </div>

          {/* Additional Prompt */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Additional Details
            </label>
            <textarea
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              placeholder="e.g. neon cyberpunk lighting, luxury penthouse background, dramatic shadows…"
              style={{
                width: "100%",
                height: 80,
                background: "#181B26",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 12px",
                color: "#e5e7eb",
                fontSize: 11,
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
              onFocus={(e) => (e.target.style.border = "1px solid rgba(124,58,237,0.5)")}
              onBlur={(e) => (e.target.style.border = "1px solid rgba(255,255,255,0.08)")}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Selection Summary */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Selections
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.keys(TABS_CONFIG).map((tabKey) =>
                TABS_CONFIG[tabKey].subcategories.map((sub) => {
                  const selId = selectedOptions[sub.id];
                  const opt = sub.options.find((o) => o.id === selId);
                  if (!opt) return null;
                  return (
                    <div
                      key={sub.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{sub.label}</span>
                      <span style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 600 }}>{opt.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
